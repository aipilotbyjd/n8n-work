import { PartialType } from "@nestjs/swagger";
import { CreateCredentialDto } from "./create-credential.dto";

export class UpdateCredentialDto extends PartialType(CreateCredentialDto) {
  // All fields from CreateCredentialDto are now optional
}
