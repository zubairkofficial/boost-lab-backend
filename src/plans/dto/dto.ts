export class CreatePlanDto {
    name: string;
    price: number;
    description: string;
    features: string[];
  }
  
  export class UpdatePlanDto {
    name?: string;
    price?: number;
    description?: string;
    features?: string[];
  }
  