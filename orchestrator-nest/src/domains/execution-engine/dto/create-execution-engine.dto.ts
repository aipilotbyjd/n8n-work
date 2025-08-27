import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsObject } from 'class-validator';

export class CreateExecutionEngineDto {
  @ApiProperty({
    description: 'The ID of the workflow to execute',
    example: 'uuid-v4',
  })
  @IsNotEmpty()
  @IsString()
  workflowId: string;

  @ApiProperty({
    description: 'The input data for the execution',
    example: { name: 'John Doe' },
  })
  @IsObject()
  input: Record<string, any>;
}
