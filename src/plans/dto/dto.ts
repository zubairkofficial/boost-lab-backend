// dto.ts
export class CreatePlanDto {
  name: string;
  oldPrice: number;
  price: number;
  description?: string[];
}

export class UpdatePlanDto {
  name?: string;
  oldPrice?: number;
  price?: number;
  description?: string[];
}
