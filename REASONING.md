### `REASONING.md`

```markdown
# Engineering Reasoning, Architecture & Testing Report

## 1. Domain Modeling: Why Medicine ≠ Inventory

In generic retail POS systems, inventory is often modeled as a simple `stock_count` integer on a product record. In pharmaceutical distribution, this approach fails:

1. **Lot Heterogeneity:** The same medicine (e.g., *Paracetamol 500mg*) arrives in distinct consignments, each with a unique manufacturer batch number and distinct expiry date.
2. **Regulatory Compliance:** Dispensing an expired drug constitutes legal liability and medical negligence. Sellable stock is not equal to physical stock on the shelf; expired inventory must be isolated immediately.

### Schema Decision
We normalized data into two distinct operational tables:
- `medicines`: Represents the persistent catalog definition (`id`, `name`, `category`).
- `batches`: Represents physical units (`id`, `medicine_id`, `batch_number`, `quantity`, `expiry_date`).

Sellable stock is never saved as a static column. It is computed dynamically at query time:
```sql
COALESCE(SUM(CASE WHEN b.expiry_date >= DATE('now') AND b.quantity > 0 THEN b.quantity ELSE 0 END), 0)


#### The FEFO Dispensing Algorithm & Transaction Safety

Step-by-Step Logic
Pre-Check: Calculate total unexpired stock for the medicine where expiry_date >= DATE('now'). If requested units exceed available sellable stock, reject immediately before taking any locks.

Queue Extraction: Fetch available batches ordered by ORDER BY expiry_date ASC, id ASC.

Waterfall Deduction: Iterate over the batches:

Deduct take = Math.min(batch.quantity, remaining).

Update batches SET quantity = quantity - take.

Record deduction metadata into dispense_logs.

Decrement remaining. Stop once remaining == 0.
