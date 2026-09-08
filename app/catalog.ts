export type Product={id:string;name:string;brand:string;category:string;price:number;original:number;image:string;colors:string[];sample:boolean;badge?:string;todayDispatch?:boolean;saleStatus?:'판매중'|'품절'|'판매 준비'};
const img=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`;
export const products:Product[]=[
{id:'sample-1',name:'소프트 니트 가디건',brand:'SOMI SELECT',category:'상의',price:32900,original:47000,image:img('photo-1683315565563-f72590773805'),colors:['베이지','차콜'],sample:true,badge:'오늘출발',todayDispatch:true},
{id:'sample-2',name:'데일리 오버핏 후드',brand:'SOMI BASIC',category:'상의',price:29900,original:42000,image:img('photo-1576727560793-1239ad9b8fcd'),colors:['화이트','블랙'],sample:true,badge:'소미 셀렉트'},
{id:'sample-3',name:'내추럴 데님 팬츠',brand:'SOMI DENIM',category:'하의',price:39900,original:52000,image:img('photo-1631112230741-446762ee05ac'),colors:['중청','진청'],sample:true,badge:'오늘출발',todayDispatch:true},
{id:'sample-4',name:'시티 데일리 재킷',brand:'SOMI SELECT',category:'아우터',price:69000,original:89000,image:'https://unsplash.com/photos/Fg15LdqpWrs/download?force=true',colors:['베이지','블랙'],sample:true,badge:'소미 셀렉트'},
{id:'sample-5',name:'에브리데이 숄더백',brand:'SOMI OBJECT',category:'가방',price:35900,original:45000,image:img('photo-1598532163257-ae3c6b2524b6'),colors:['블랙','브라운'],sample:true,badge:'오늘출발',todayDispatch:true},
{id:'sample-6',name:'클래식 스니커즈',brand:'SOMI BASIC',category:'신발',price:49000,original:59000,image:img('photo-1491553895911-0055eca6402d'),colors:['화이트','블랙'],sample:true,badge:'소미 셀렉트'}];
export const money=(n:number)=>n.toLocaleString('ko-KR');
