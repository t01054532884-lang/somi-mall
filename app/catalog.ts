export type SizeRow = {
  size: string;
  totalLength: string;
  shoulder: string;
  chest: string;
  sleeve: string;
  sleeveOpening: string;
  armhole: string;
  hem: string;
};
export type SellerInfo = {
  name: string;
  representative: string;
  address: string;
  businessNumber: string;
  mailOrderNumber: string;
  email: string;
  phone: string;
};
export type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  collections?: string[];
  price: number;
  original: number;
  image: string;
  colors: string[];
  sample: boolean;
  badge?: string;
  todayDispatch?: boolean;
  saleStatus?: '판매중' | '품절' | '판매 준비';
  styleTag?: '에겐녀' | '테토녀' | '미분류';
  reviewCount?: number;
  averageRating?: number;
  salesCount?: number;
  stock?: number;
  description?: string;
  detailImages?: string[];
  material?: string;
  origin?: string;
  manufacturer?: string;
  sizeChart?: SizeRow[];
  seller?: SellerInfo;
};
export const PRODUCT_COLLECTIONS = [
  'BEST',
  'NEW',
  '아우터',
  '원피스',
  '니트',
  '블라우스/셔츠',
  '스커트',
  '팬츠',
  '언더웨어',
  '악세잡화',
] as const;
const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`;
export const products: Product[] = [
  {
    id: 'sample-1',
    name: '소프트 니트 가디건',
    brand: 'SOMI SELECT',
    category: '상의',
    collections: ['BEST', 'NEW', '니트'],
    price: 32900,
    original: 47000,
    image: img('photo-1683315565563-f72590773805'),
    colors: ['베이지', '차콜'],
    sample: true,
    badge: '오늘출발',
    todayDispatch: true,
    description:
      '포근한 촉감과 자연스럽게 떨어지는 실루엣이 매력적인 데일리 가디건입니다. 단독으로도, 가벼운 아우터로도 편하게 입을 수 있어요.',
    material: '아크릴 70%, 폴리에스터 30%',
    origin: '대한민국',
    manufacturer: 'SOMI SELECT 협력업체',
    sizeChart: [
      {
        size: 'FREE',
        totalLength: '64',
        shoulder: '52',
        chest: '56',
        sleeve: '67',
        sleeveOpening: '17',
        armhole: '23',
        hem: '40',
      },
    ],
  },
  {
    id: 'sample-2',
    name: '데일리 오버핏 후드',
    brand: 'SOMI BASIC',
    category: '상의',
    collections: ['NEW', '니트'],
    price: 29900,
    original: 42000,
    image: img('photo-1576727560793-1239ad9b8fcd'),
    colors: ['화이트', '블랙'],
    sample: true,
    badge: '소미 셀렉트',
  },
  {
    id: 'sample-3',
    name: '내추럴 데님 팬츠',
    brand: 'SOMI DENIM',
    category: '하의',
    collections: ['BEST', '팬츠'],
    price: 39900,
    original: 52000,
    image: img('photo-1631112230741-446762ee05ac'),
    colors: ['중청', '진청'],
    sample: true,
    badge: '오늘출발',
    todayDispatch: true,
  },
  {
    id: 'sample-4',
    name: '시티 데일리 재킷',
    brand: 'SOMI SELECT',
    category: '아우터',
    collections: ['아우터'],
    price: 69000,
    original: 89000,
    image: 'https://unsplash.com/photos/Fg15LdqpWrs/download?force=true',
    colors: ['베이지', '블랙'],
    sample: true,
    badge: '소미 셀렉트',
  },
  {
    id: 'sample-5',
    name: '에브리데이 숄더백',
    brand: 'SOMI OBJECT',
    category: '가방',
    collections: ['악세잡화'],
    price: 35900,
    original: 45000,
    image: img('photo-1598532163257-ae3c6b2524b6'),
    colors: ['블랙', '브라운'],
    sample: true,
    badge: '오늘출발',
    todayDispatch: true,
  },
  {
    id: 'sample-6',
    name: '클래식 스니커즈',
    brand: 'SOMI BASIC',
    category: '신발',
    collections: ['악세잡화'],
    price: 49000,
    original: 59000,
    image: img('photo-1491553895911-0055eca6402d'),
    colors: ['화이트', '블랙'],
    sample: true,
    badge: '소미 셀렉트',
  },
];
export const money = (n: number) => n.toLocaleString('ko-KR');
