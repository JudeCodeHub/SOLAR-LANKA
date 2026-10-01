"""One customer request delivers independently to each selected company."""

from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.models.company import Company
from app.models.estimator_config import EstimatorConfigVersion
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_request_has_separate_company_deliveries(database_connection, database_session):
    schema = f"request_delivery_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser,
        Company,
        EstimatorConfigVersion,
        SavedEstimate,
        QuotationRequest,
        RequestDelivery,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_request_customer")
    company_a = Company(name="Fictional company A", publication_status="approved")
    company_b = Company(name="Fictional company B", publication_status="approved")
    database_session.add_all([customer, company_a, company_b])
    database_session.flush()
    request = QuotationRequest(
        customer_id=customer.id,
        requirements={"monthly_consumption_kwh": "300", "district": "Colombo"},
    )
    database_session.add(request)
    database_session.flush()
    delivery_a = RequestDelivery(request_id=request.id, company_id=company_a.id)
    delivery_b = RequestDelivery(request_id=request.id, company_id=company_b.id)
    database_session.add_all([delivery_a, delivery_b])
    database_session.commit()

    deliveries = list(
        database_session.scalars(
            select(RequestDelivery).where(RequestDelivery.request_id == request.id)
        )
    )
    assert len(deliveries) == 2
    assert {delivery.company_id for delivery in deliveries} == {company_a.id, company_b.id}
    assert delivery_a.id != delivery_b.id
    assert request.status == "submitted"
    assert delivery_a.status == delivery_b.status == "submitted"
    assert request.created_at.utcoffset() is not None
    assert delivery_a.created_at.utcoffset() is not None

    delivery_a.status = "viewed"
    database_session.commit()
    database_session.refresh(delivery_b)
    assert delivery_b.status == "submitted"
    with pytest.raises(IntegrityError):
        with database_session.begin_nested():
            database_session.add(RequestDelivery(request_id=request.id, company_id=company_a.id))
            database_session.flush()
