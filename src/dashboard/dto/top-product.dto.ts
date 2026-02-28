export class TopProductDto {
  id: string;
  productName: string;
  imageUrl: string;
  status: 'Live' | 'Draft';
  salesCount: number;
  earnings: number;
}
