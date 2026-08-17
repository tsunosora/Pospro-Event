export interface CreatePengajuanDto {
  eventId: number;
  title?: string | null;
  items?: CreatePengajuanItemDto[]; // opsional; item bisa ditambah belakangan
}

export interface CreatePengajuanItemDto {
  categoryId: number;
  description: string;
  unit?: string | null;
  quantity: number;
  price: number;
}

export type UpdatePengajuanItemDto = Partial<CreatePengajuanItemDto>;
