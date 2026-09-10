import { PRODUCT_COLLECTIONS } from '@/app/catalog';

export type ProductInput = {
  name: string;
  brand: string;
  category: string;
  collections: string[];
  price: number;
  originalPrice: number;
  imageUrl: string;
  colors: string[];
  badge: string;
  todayDispatch: boolean;
  active: boolean;
  saleStatus: '판매중' | '품절' | '판매 준비';
  styleTag: '에겐녀' | '테토녀' | '미분류';
  sortOrder: number;
  stock: number;
  description: string;
  detailImages: string[];
  material: string;
  origin: string;
  manufacturer: string;
  sizeChart: Array<Record<string, string>>;
  sellerName: string;
  sellerRepresentative: string;
  sellerAddress: string;
  sellerBusinessNumber: string;
  sellerMailOrderNumber: string;
  sellerEmail: string;
  sellerPhone: string;
};

export function parseProductInput(formData: FormData): ProductInput {
  const name = requiredText(formData, 'name', 100);
  const brand = requiredText(formData, 'brand', 80);
  const collections = formData
    .getAll('collections')
    .filter((value): value is string => typeof value === 'string')
    .filter((value) =>
      PRODUCT_COLLECTIONS.includes(
        value as (typeof PRODUCT_COLLECTIONS)[number],
      ),
    );
  if (!collections.length)
    throw new Error('상품 목록을 하나 이상 선택해 주세요.');
  const category =
    collections.find((value) => !['BEST', 'NEW'].includes(value)) ??
    collections[0];
  const price = positiveInteger(formData, 'price');
  const originalPrice = positiveInteger(formData, 'originalPrice');
  if (originalPrice < price)
    throw new Error('정가는 판매가보다 작을 수 없습니다.');
  const imageUrl = requiredText(formData, 'imageUrl', 500);
  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.protocol !== 'https:')
    throw new Error('상품 이미지는 HTTPS 주소만 사용할 수 있습니다.');
  const saleStatus = formText(formData, 'saleStatus');
  const styleTag = formText(formData, 'styleTag');
  if (!['판매중', '품절', '판매 준비'].includes(saleStatus))
    throw new Error('판매 상태를 선택해 주세요.');
  if (!['에겐녀', '테토녀', '미분류'].includes(styleTag))
    throw new Error('스타일 분류를 선택해 주세요.');

  return {
    name,
    brand,
    category,
    collections: [...new Set(collections)],
    price,
    originalPrice,
    imageUrl: parsedUrl.toString(),
    colors: formText(formData, 'colors')
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean)
      .slice(0, 20),
    badge: optionalText(formData, 'badge', 30) || '소미 셀렉트',
    todayDispatch: formData.get('todayDispatch') === 'on',
    active: formData.get('active') === 'on',
    saleStatus: saleStatus as ProductInput['saleStatus'],
    styleTag: styleTag as ProductInput['styleTag'],
    sortOrder: integer(formData, 'sortOrder'),
    stock: positiveInteger(formData, 'stock'),
    description: optionalText(formData, 'description', 10000),
    detailImages: parseJsonArray(formText(formData, 'detailImages')),
    material: optionalText(formData, 'material', 300),
    origin: optionalText(formData, 'origin', 100),
    manufacturer: optionalText(formData, 'manufacturer', 200),
    sizeChart: parseSizeChart(formText(formData, 'sizeChart')),
    sellerName: optionalText(formData, 'sellerName', 120),
    sellerRepresentative: optionalText(formData, 'sellerRepresentative', 80),
    sellerAddress: optionalText(formData, 'sellerAddress', 300),
    sellerBusinessNumber: optionalText(formData, 'sellerBusinessNumber', 40),
    sellerMailOrderNumber: optionalText(formData, 'sellerMailOrderNumber', 80),
    sellerEmail: optionalText(formData, 'sellerEmail', 150),
    sellerPhone: optionalText(formData, 'sellerPhone', 40),
  };
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 12)
      : [];
  } catch {
    return [];
  }
}
function parseSizeChart(value: string) {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const [
        size = '',
        totalLength = '',
        shoulder = '',
        chest = '',
        sleeve = '',
        sleeveOpening = '',
        armhole = '',
        hem = '',
      ] = line.split('|').map((x) => x.trim());
      return {
        size,
        totalLength,
        shoulder,
        chest,
        sleeve,
        sleeveOpening,
        armhole,
        hem,
      };
    })
    .filter((row) => row.size);
}

function requiredText(formData: FormData, key: string, maxLength: number) {
  const value = optionalText(formData, key, maxLength);
  if (!value) throw new Error(`${key} 항목을 입력해 주세요.`);
  return value;
}

function optionalText(formData: FormData, key: string, maxLength: number) {
  return formText(formData, key).trim().slice(0, maxLength);
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function positiveInteger(formData: FormData, key: string) {
  const value = integer(formData, key);
  if (value < 0) throw new Error(`${key} 값은 0 이상이어야 합니다.`);
  return value;
}

function integer(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isSafeInteger(value))
    throw new Error(`${key} 값이 올바르지 않습니다.`);
  return value;
}
