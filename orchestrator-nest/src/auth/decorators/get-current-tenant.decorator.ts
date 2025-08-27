import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetCurrentTenant = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant) {
      return null;
    }

    return data ? tenant[data] : tenant.id;
  },
);
