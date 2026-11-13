"""Sellers' stock: who may sell, what they put on sale, and what buyers see."""

import pytest
from sqlalchemy import select

from app.models import Card, CardPrinting, CardSet, Rarity, User, UserProfile
from app.services import accounts, passwords

PASSWORD = "dragon blanco de ojos azules"
PEOPLE = ("tienda@example.com", "ana@example.com")


@pytest.fixture
def client(client, settings, monkeypatch, factory):
    monkeypatch.setattr(settings, "deployment_mode", "local")
    monkeypatch.setattr(passwords, "SCRYPT_N", 2**10)
    monkeypatch.setattr(passwords, "SCRYPT_P", 1)
    accounts.limiter.clear()
    for email in PEOPLE:
        client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "display_name": email.split("@")[0],
                "accept_terms": True,
                "confirm_adult": True,
            },
        )
    with factory.begin() as session:
        seller = session.scalar(select(User).where(User.email == "tienda@example.com"))
        session.add(
            UserProfile(
                user_id=seller.id, account_role="seller", store_name="La Tienda", country="Uruguay"
            )
        )
        card = Card(display_name="Dragón Sintético", game="magic")
        printing = CardPrinting(
            card=card,
            card_set=CardSet(
                source_key="tst", name="Set de Prueba", language="en", market="MTG", game="magic"
            ),
            rarity=Rarity(name="Rare"),
            code="TST-001",
            language="en",
            market="MTG",
            finishes=["nonfoil", "foil"],
        )
        session.add(printing)
    client.cookies.clear()
    return client


@pytest.fixture
def printing_id(factory):
    with factory() as session:
        return str(session.scalar(select(CardPrinting.id)))


def sign_in(client, email):
    client.cookies.clear()
    client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    client.headers["X-CSRF-Token"] = client.cookies.get("cm_csrf") or ""


def offer(printing_id, **changes):
    return {
        "printing_id": printing_id,
        "condition": "NM",
        "language": "EN",
        "finish": "foil",
        "quantity": 3,
        "price": "12.50",
        "currency": "UYU",
        **changes,
    }


def test_a_seller_puts_cards_on_sale_and_buyers_see_them(client, printing_id):
    sign_in(client, "tienda@example.com")
    added = client.post("/api/v1/listings", json=offer(printing_id))
    assert added.status_code == 201
    listing = added.json()
    assert listing["seller"]["name"] == "La Tienda" and listing["seller"]["country"] == "Uruguay"
    assert (listing["code"], listing["rarity"], listing["finish"]) == ("TST-001", "Rare", "foil")
    own = client.get("/api/v1/listings/mine")
    assert [row["id"] for row in own.json()] == [listing["id"]]
    # A seller's own stock is never kept by browsers or proxies.
    assert own.headers["cache-control"] == "private, no-store"

    client.cookies.clear()
    seen = client.get("/api/v1/listings", params={"card_id": listing["card_id"]}).json()
    assert [(row["quantity"], row["price"], row["currency"]) for row in seen] == [
        (3, "12.50", "UYU")
    ]
    assert client.get("/api/v1/listings", params={"game": "pokemon"}).json() == []
    by_seller = client.get("/api/v1/listings", params={"seller_id": listing["seller"]["id"]})
    assert len(by_seller.json()) == 1


def test_a_seller_changes_and_removes_only_their_own(client, printing_id):
    sign_in(client, "tienda@example.com")
    listing = client.post("/api/v1/listings", json=offer(printing_id)).json()
    changed = client.patch(f"/api/v1/listings/{listing['id']}", json={"quantity": 1, "price": "9"})
    assert (changed.json()["quantity"], changed.json()["price"]) == (1, "9.00")

    sign_in(client, "ana@example.com")
    assert (
        client.patch(f"/api/v1/listings/{listing['id']}", json={"quantity": 5}).status_code == 404
    )
    assert client.delete(f"/api/v1/listings/{listing['id']}").status_code == 404

    sign_in(client, "tienda@example.com")
    assert client.delete(f"/api/v1/listings/{listing['id']}").status_code == 204
    assert client.get("/api/v1/listings/mine").json() == []


def test_only_sellers_sell_and_nonsense_is_refused(client, printing_id, factory):
    sign_in(client, "ana@example.com")
    refused = client.post("/api/v1/listings", json=offer(printing_id))
    assert refused.status_code == 403 and "Vendedor" in refused.json()["error"]["message"]

    sign_in(client, "tienda@example.com")
    for wrong in ({"quantity": 0}, {"price": "0"}, {"condition": "XX"}, {"currency": "JPY"}):
        assert client.post("/api/v1/listings", json=offer(printing_id, **wrong)).status_code == 422
    assert (
        client.post("/api/v1/listings", json=offer(printing_id, finish="etched")).status_code == 400
    )

    # Someone who stops selling no longer shows their offers.
    listing = client.post("/api/v1/listings", json=offer(printing_id)).json()
    with factory.begin() as session:
        session.scalar(select(UserProfile)).account_role = "buyer"
    client.cookies.clear()
    assert client.get("/api/v1/listings", params={"card_id": listing["card_id"]}).json() == []


def test_the_stock_goes_with_the_account(client, printing_id, factory):
    sign_in(client, "tienda@example.com")
    client.post("/api/v1/listings", json=offer(printing_id))
    exported = client.get("/api/v1/account/export").json()
    assert [row["code"] for row in exported["listings"]] == ["TST-001"]
