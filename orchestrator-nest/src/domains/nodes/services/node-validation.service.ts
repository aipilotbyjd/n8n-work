import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NodeValidationService {
  private readonly logger = new Logger(NodeValidationService.name);

  async validateNodeCode(
    code: string,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Basic syntax validation
      if (!code || code.trim().length === 0) {
        errors.push("Node code cannot be empty");
        return { isValid: false, errors };
      }

      // Check for required function structure
      if (
        !code.includes("function execute") &&
        !code.includes("const execute")
      ) {
        errors.push("Node code must contain an execute function");
      }

      // Check for potentially dangerous operations
      const dangerousPatterns = [
        /require\s*\(\s*['"]fs['"]\s*\)/,
        /require\s*\(\s*['"]child_process['"]\s*\)/,
        /require\s*\(\s*['"]os['"]\s*\)/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\.exit/,
        /process\.kill/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          errors.push(
            `Potentially unsafe operation detected: ${pattern.source}`,
          );
        }
      }

      // Try to parse as JavaScript (basic syntax check)
      try {
        new Function(code);
      } catch (syntaxError) {
        errors.push(`JavaScript syntax error: ${syntaxError.message}`);
      }
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async validateNodeDefinition(
    definition: any,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check required properties
      if (!definition.inputs || !Array.isArray(definition.inputs)) {
        errors.push("Node definition must have an inputs array");
      }

      if (!definition.outputs || !Array.isArray(definition.outputs)) {
        errors.push("Node definition must have an outputs array");
      }

      if (!definition.properties || !Array.isArray(definition.properties)) {
        errors.push("Node definition must have a properties array");
      }

      // Validate inputs
      if (definition.inputs) {
        definition.inputs.forEach((input: any, index: number) => {
          if (typeof input !== "string") {
            errors.push(`Input at index ${index} must be a string`);
          }
        });
      }

      // Validate outputs
      if (definition.outputs) {
        definition.outputs.forEach((output: any, index: number) => {
          if (typeof output !== "string") {
            errors.push(`Output at index ${index} must be a string`);
          }
        });
      }

      // Validate properties
      if (definition.properties) {
        definition.properties.forEach((property: any, index: number) => {
          const propErrors = this.validateNodeProperty(property, index);
          errors.push(...propErrors);
        });
      }
    } catch (error) {
      errors.push(`Definition validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateNodeProperty(property: any, index: number): string[] {
    const errors: string[] = [];

    if (!property.name || typeof property.name !== "string") {
      errors.push(`Property at index ${index} must have a valid name`);
    }

    if (!property.displayName || typeof property.displayName !== "string") {
      errors.push(`Property at index ${index} must have a valid displayName`);
    }

    if (!property.type || typeof property.type !== "string") {
      errors.push(`Property at index ${index} must have a valid type`);
    }

    const validTypes = [
      "string",
      "number",
      "boolean",
      "collection",
      "options",
      "multiOptions",
      "dateTime",
      "json",
      "notice",
      "hidden",
      "color",
      "credentialsSelect",
    ];

    if (property.type && !validTypes.includes(property.type)) {
      errors.push(
        `Property at index ${index} has invalid type: ${property.type}`,
      );
    }

    // Validate type-specific properties
    if (property.type === "options" || property.type === "multiOptions") {
      if (!property.options || !Array.isArray(property.options)) {
        errors.push(
          `Property at index ${index} with type ${property.type} must have options array`,
        );
      } else {
        property.options.forEach((option: any, optIndex: number) => {
          if (!option.name || !option.value) {
            errors.push(
              `Option at index ${optIndex} in property ${index} must have name and value`,
            );
          }
        });
      }
    }

    if (property.type === "number") {
      if (property.typeOptions) {
        if (
          property.typeOptions.minValue !== undefined &&
          typeof property.typeOptions.minValue !== "number"
        ) {
          errors.push(`Property at index ${index} minValue must be a number`);
        }
        if (
          property.typeOptions.maxValue !== undefined &&
          typeof property.typeOptions.maxValue !== "number"
        ) {
          errors.push(`Property at index ${index} maxValue must be a number`);
        }
      }
    }

    return errors;
  }

  async validateNodeExecution(
    nodeCode: string,
    input: any,
  ): Promise<{
    isValid: boolean;
    output?: any;
    error?: string;
    executionTime?: number;
  }> {
    const startTime = Date.now();

    try {
      // Create a safe execution context
      const executeFunction = new Function(
        "input",
        `
        ${nodeCode}
        return execute(input);
      `,
      );

      const output = executeFunction(input);
      const executionTime = Date.now() - startTime;

      return {
        isValid: true,
        output,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        isValid: false,
        error: error.message,
        executionTime,
      };
    }
  }

  async validateCredentialRequirements(
    nodeDefinition: any,
    supportedCredentials: string[],
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!nodeDefinition.properties) {
      return { isValid: true, errors };
    }

    // Check for credential properties
    const credentialProperties = nodeDefinition.properties.filter(
      (prop: any) =>
        prop.type === "credentialsSelect" ||
        prop.name?.toLowerCase().includes("credential"),
    );

    for (const credProp of credentialProperties) {
      if (credProp.credentialTypes) {
        for (const credType of credProp.credentialTypes) {
          if (!supportedCredentials.includes(credType)) {
            errors.push(`Unsupported credential type: ${credType}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async performSecurityScan(code: string): Promise<{
    passed: boolean;
    vulnerabilities: Array<{
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      line?: number;
    }>;
  }> {
    const vulnerabilities: Array<{
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      line?: number;
    }> = [];

    // Check for dangerous patterns
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        type: "code_injection",
        severity: "critical" as const,
        description: "Use of eval() can lead to code injection vulnerabilities",
      },
      {
        pattern: /Function\s*\(/g,
        type: "code_injection",
        severity: "high" as const,
        description: "Dynamic function creation can be dangerous",
      },
      {
        pattern: /require\s*\(\s*['"]child_process['"]\s*\)/g,
        type: "command_injection",
        severity: "critical" as const,
        description: "Use of child_process can lead to command injection",
      },
      {
        pattern: /require\s*\(\s*['"]fs['"]\s*\)/g,
        type: "file_access",
        severity: "high" as const,
        description: "Direct file system access detected",
      },
      {
        pattern: /process\.env/g,
        type: "environment_access",
        severity: "medium" as const,
        description: "Access to environment variables detected",
      },
      {
        pattern: /\$\{.*\}/g,
        type: "template_injection",
        severity: "medium" as const,
        description: "Potential template injection vulnerability",
      },
    ];

    const lines = code.split("\n");

    for (const { pattern, type, severity, description } of securityPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineIndex = code.substring(0, match.index).split("\n").length - 1;

        vulnerabilities.push({
          type,
          severity,
          description,
          line: lineIndex + 1,
        });
      }
    }

    return {
      passed:
        vulnerabilities.filter(
          (v) => v.severity === "critical" || v.severity === "high",
        ).length === 0,
      vulnerabilities,
    };
  }
}
