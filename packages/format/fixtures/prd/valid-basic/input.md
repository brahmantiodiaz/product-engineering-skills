# PRD: Product Order

Intro text.

### REQ-001 Agreement required before Product Order
A Product Order can only be created when its Agreement is Approved.
**Status:** decided · **Criticality:** blocker

- [AC-001] Given a Draft Agreement, when a user creates a Product Order, then it is rejected
- [AC-002] Given an Approved Agreement, when a user creates a Product Order, then it is accepted

### REQ-002 Quote must be valid
**Status:** open · **Criticality:** major
- [AC-003] Given an expired Quote, then the order is rejected
