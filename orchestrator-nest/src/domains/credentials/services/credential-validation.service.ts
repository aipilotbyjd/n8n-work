import { Injectable, BadRequestException } from "@nestjs/common";
import { CredentialType } from "../entities/credential-type.entity";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import axios from "axios";

@Injectable()
export class CredentialValidationService {
  private readonly ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }

  /**
   * Validate credential data against type schema
   */
  async validateCredentialData(data: any, schema: any): Promise<void> {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      const errors = validate.errors
        ?.map((error) => `${error.instancePath || "root"} ${error.message}`)
        .join(", ");
      throw new BadRequestException(`Credential validation failed: ${errors}`);
    }
  }

  /**
   * Test credential connection
   */
  async testCredential(
    data: any,
    credentialType: CredentialType,
  ): Promise<boolean> {
    try {
      switch (credentialType.name) {
        case "httpBasicAuth":
          return this.testHttpBasicAuth(data);
        case "httpHeaderAuth":
          return this.testHttpHeaderAuth(data);
        case "httpQueryAuth":
          return this.testHttpQueryAuth(data);
        case "apiKey":
          return this.testApiKey(data);
        case "googleApi":
          return this.testGoogleApi(data);
        case "slackApi":
          return this.testSlackApi(data);
        case "githubApi":
          return this.testGitHubApi(data);
        case "awsApi":
          return this.testAwsApi(data);
        default:
          // For unknown types, just validate that required fields are present
          return this.basicValidation(data, credentialType.schema);
      }
    } catch (error) {
      console.error(
        `Credential test failed for type ${credentialType.name}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Test HTTP Basic Authentication
   */
  private async testHttpBasicAuth(data: any): Promise<boolean> {
    if (!data.testUrl || !data.username || !data.password) {
      return false;
    }

    try {
      const response = await axios.get(data.testUrl, {
        auth: {
          username: data.username,
          password: data.password,
        },
        timeout: 10000,
      });

      return response.status >= 200 && response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test HTTP Header Authentication
   */
  private async testHttpHeaderAuth(data: any): Promise<boolean> {
    if (!data.testUrl || !data.headerName || !data.headerValue) {
      return false;
    }

    try {
      const headers = {
        [data.headerName]: data.headerValue,
      };

      const response = await axios.get(data.testUrl, {
        headers,
        timeout: 10000,
      });

      return response.status >= 200 && response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test HTTP Query Authentication
   */
  private async testHttpQueryAuth(data: any): Promise<boolean> {
    if (!data.testUrl || !data.queryName || !data.queryValue) {
      return false;
    }

    try {
      const url = new URL(data.testUrl);
      url.searchParams.set(data.queryName, data.queryValue);

      const response = await axios.get(url.toString(), {
        timeout: 10000,
      });

      return response.status >= 200 && response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test API Key
   */
  private async testApiKey(data: any): Promise<boolean> {
    if (!data.apiKey) {
      return false;
    }

    // For generic API key, we can only validate format
    return typeof data.apiKey === "string" && data.apiKey.length > 0;
  }

  /**
   * Test Google API credentials
   */
  private async testGoogleApi(data: any): Promise<boolean> {
    if (!data.apiKey && !data.serviceAccountKey) {
      return false;
    }

    try {
      if (data.apiKey) {
        // Test with a simple API call
        const response = await axios.get(
          `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${data.apiKey}`,
          { timeout: 10000 },
        );
        return response.status === 200;
      }

      if (data.serviceAccountKey) {
        // For service account, validate JSON structure
        const serviceAccount = JSON.parse(data.serviceAccountKey);
        return !!(serviceAccount.private_key && serviceAccount.client_email);
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test Slack API credentials
   */
  private async testSlackApi(data: any): Promise<boolean> {
    if (!data.accessToken) {
      return false;
    }

    try {
      const response = await axios.post(
        "https://slack.com/api/auth.test",
        {},
        {
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      return response.data?.ok === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test GitHub API credentials
   */
  private async testGitHubApi(data: any): Promise<boolean> {
    if (!data.accessToken) {
      return false;
    }

    try {
      const response = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `token ${data.accessToken}`,
          "User-Agent": "N8N-Work-Credential-Test",
        },
        timeout: 10000,
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test AWS API credentials
   */
  private async testAwsApi(data: any): Promise<boolean> {
    if (!data.accessKeyId || !data.secretAccessKey) {
      return false;
    }

    // For AWS, we'll just validate the format
    // Actual testing would require AWS SDK integration
    const accessKeyPattern = /^AKIA[0-9A-Z]{16}$/;
    const secretKeyPattern = /^[A-Za-z0-9/+=]{40}$/;

    return (
      accessKeyPattern.test(data.accessKeyId) &&
      secretKeyPattern.test(data.secretAccessKey)
    );
  }

  /**
   * Basic validation for unknown credential types
   */
  private async basicValidation(data: any, schema: any): Promise<boolean> {
    try {
      const validate = this.ajv.compile(schema);
      return validate(data);
    } catch (error) {
      return false;
    }
  }
}
