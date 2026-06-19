PENDING = "pending"
PROCESSING = "processing"
DELIVERED = "delivered"
CANCELLED = "cancelled"

ORDER_STATUS_CHOICES = (
    (PENDING, "Pending"),
    (PROCESSING, "Processing"),
    (DELIVERED, "Delivered"),
    (CANCELLED, "Cancelled"),
)

PAYMENT_PENDING = "payment_pending"
PAID = "paid"
FAILED = "failed"
REFUNDED = "refunded"
CASH_ON_DELIVERY = "cash_on_delivery"

PAYMENT_STATUS_CHOICES = (
    (PAYMENT_PENDING, "Payment Pending"),
    (PAID, "Paid"),
    (FAILED, "Failed"),
    (REFUNDED, "Refunded"),
    (CASH_ON_DELIVERY, "Cash on Delivery"),
)