import Checkout from './checkout';
import {getMemberSession} from '@/app/google-auth';
import {getMemberCoupon} from '@/db/orders';
export const dynamic='force-dynamic';
export default async function Page(){const member=await getMemberSession();let coupon=null;try{if(member)coupon=await getMemberCoupon(member.memberId)}catch{}return <Checkout signedIn={Boolean(member)} couponAvailable={Boolean(coupon&&!coupon.used)}/>}
