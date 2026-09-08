const CATEGORIES = ['상의', '하의', '아우터', '가방', '신발', '액세서리'];

export type ProductInput = {
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  colors: string[];
  badge: string;
  todayDispatch: boolean;
  active: boolean;
  saleStatus: '판매중' | '품절' | '판매 준비';
  sortOrder: number;
};

export function parseProductInput(formData: FormData): ProductInput {
  const name = requiredText(formData, 'name', 100);
  const brand = requiredText(formData, 'brand', 80);
  const category = requiredText(formData, 'category', 30);
  if (!CATEGORIES.includes(category)) throw new Error('지원하지 않는 카테고리입니다.');
  const price = positiveInteger(formData, 'price');
  const originalPrice = positiveInteger(formData, 'originalPrice');
  if (originalPrice < price) throw new Error('정가는 판매가보다 작을 수 없습니다.');
  const imageUrl = requiredText(formData, 'imageUrl', 500);
  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('상품 이미지는 HTTPS 주소만 사용할 수 있습니다.');
  const saleStatus = formText(formData, 'saleStatus');
  if (!['판매중','품절','판매 준비'].includes(saleStatus)) throw new Error('판매 상태를 선택해 주세요.');

  return {
    name,
    brand,
    category,
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
    sortOrder: integer(formData, 'sortOrder'),
  };
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
  if (!Number.isSafeInteger(value)) throw new Error(`${key} 값이 올바르지 않습니다.`);
  return value;
}
