"""Initial installation workflow policy (Phase 11.01)."""

from enum import StrEnum


class InstallationMilestone(StrEnum):
    SITE_SURVEY = "site_survey"
    SYSTEM_DESIGN = "system_design"
    PERMITS_AND_APPROVALS = "permits_and_approvals"
    EQUIPMENT_DELIVERY = "equipment_delivery"
    INSTALLATION_WORK = "installation_work"
    INSPECTION_AND_TESTING = "inspection_and_testing"
    COMMISSIONING = "commissioning"
    CUSTOMER_HANDOVER = "customer_handover"


class MilestoneStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


SEQUENCE: tuple[InstallationMilestone, ...] = tuple(InstallationMilestone)

# Evidence is private to the installation.
REQUIRED_EVIDENCE: dict[InstallationMilestone, frozenset[str]] = {
    InstallationMilestone.SITE_SURVEY: frozenset({"site_survey_record"}),
    InstallationMilestone.SYSTEM_DESIGN: frozenset({"approved_system_design"}),
    InstallationMilestone.PERMITS_AND_APPROVALS: frozenset({"approval_record"}),
    InstallationMilestone.EQUIPMENT_DELIVERY: frozenset({"delivery_record"}),
    InstallationMilestone.INSTALLATION_WORK: frozenset({"installation_photos"}),
    InstallationMilestone.INSPECTION_AND_TESTING: frozenset({"inspection_test_record"}),
    InstallationMilestone.COMMISSIONING: frozenset({"commissioning_record"}),
    InstallationMilestone.CUSTOMER_HANDOVER: frozenset({"handover_acknowledgement"}),
}


def can_transition(
    current: MilestoneStatus,
    target: MilestoneStatus,
    *,
    milestone: InstallationMilestone,
    predecessor_completed: bool,
    verified_evidence: frozenset[str] = frozenset(),
    reset_reason: str | None = None,
) -> bool:
    """Check order and evidence; the caller must separately enforce permissions."""
    if current is MilestoneStatus.PENDING and target is MilestoneStatus.IN_PROGRESS:
        return predecessor_completed
    if current is MilestoneStatus.IN_PROGRESS and target is MilestoneStatus.PENDING:
        return bool(reset_reason and reset_reason.strip())
    if current is MilestoneStatus.IN_PROGRESS and target is MilestoneStatus.COMPLETED:
        return can_complete(milestone, status=current, verified_evidence=verified_evidence)
    return False


def can_complete(
    milestone: InstallationMilestone,
    *,
    status: MilestoneStatus,
    verified_evidence: frozenset[str],
) -> bool:
    """A started milestone completes only with all required verified evidence."""
    return status is MilestoneStatus.IN_PROGRESS and REQUIRED_EVIDENCE[milestone].issubset(
        verified_evidence
    )
