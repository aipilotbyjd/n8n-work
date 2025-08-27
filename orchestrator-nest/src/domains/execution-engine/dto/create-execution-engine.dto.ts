import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsObject } from "class-validator";

export class CreateExecutionEngineDto {
  @ApiProperty({
    description: "The ID of the workflow to execute",
    example: "wf_12345",
  })
  @IsString()
  @IsNotEmpty()
  workflowId: string;

  @ApiProperty({
    description: "The input data for the workflow execution",
    example: { key: "value" },
  })
  @IsObject()
  input: Record<string, any>;
}
