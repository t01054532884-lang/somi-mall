import {getD1} from './index';

export type AdminOrder={id:string;orderNumber:string;memberId:string;memberName:string;email:string;recipient:string;phone:string;address:string;memo:string;status:string;paymentStatus:string;subtotal:number;discount:number;shippingFee:number;total:number;carrier:string;trackingNumber:string;createdAt:string;items:{productId:string;productName:string;optionName:string;quantity:number;unitPrice:number;lineTotal:number}[]};

export async function listAdminOrders(){
 const orders=await getD1().prepare('SELECT id, order_number, member_id, member_name, email, recipient, phone, address, memo, status, payment_status, subtotal, discount, shipping_fee, total, carrier, tracking_number, created_at FROM orders ORDER BY created_at DESC').all<any>();
 const items=await getD1().prepare('SELECT order_id, product_id, product_name, option_name, quantity, unit_price, line_total FROM order_items ORDER BY rowid').all<any>();
 return orders.results.map((o:any)=>({id:o.id,orderNumber:o.order_number,memberId:o.member_id,memberName:o.member_name,email:o.email,recipient:o.recipient,phone:o.phone,address:o.address,memo:o.memo,status:o.status,paymentStatus:o.payment_status,subtotal:o.subtotal,discount:o.discount,shippingFee:o.shipping_fee,total:o.total,carrier:o.carrier,trackingNumber:o.tracking_number,createdAt:o.created_at,items:items.results.filter((i:any)=>i.order_id===o.id).map((i:any)=>({productId:i.product_id,productName:i.product_name,optionName:i.option_name,quantity:i.quantity,unitPrice:i.unit_price,lineTotal:i.line_total}))})) as AdminOrder[];
}

export async function listMemberOrders(memberId:string){
 const all=await listAdminOrders(); return all.filter(order=>order.memberId===memberId);
}

export async function getMemberCoupon(memberId:string){
 const row=await getD1().prepare("SELECT id, name, discount_rate, max_discount, used FROM coupons WHERE member_id=? AND code='WELCOME10'").bind(memberId).first<any>();
 return row?{id:row.id,name:row.name,discountRate:row.discount_rate,maxDiscount:row.max_discount,used:Boolean(row.used)}:null;
}
