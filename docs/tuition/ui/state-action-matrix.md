# State-action matrix

| Trạng thái | Xem | Sửa | Thanh toán | Biên lai | Hủy/miễn |
|---|---:|---:|---:|---:|---:|
| UNPAID | Có | Có | Có | Không | Có |
| OVERDUE | Có | Có | Có | Không | Có |
| PAID | Có | Không | Không | Có | Hoàn tiền theo quyền |
| EXEMPTED | Có | Không | Không | Không | Không |
| CANCELLED | Có | Không | Không | Không | Không |

Mọi action tài chính phải disable khi đang submit và backend vẫn là nguồn kiểm tra cuối.
