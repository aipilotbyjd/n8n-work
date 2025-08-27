import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Credential } from "../entities/credential.entity";
import { OAuthToken } from "../entities/oauth-token.entity";
import { CredentialEncryptionService } from "./credential-encryption.service";
import { CredentialResponseDto } from "../dto/credential-response.dto";
import axios from "axios";

interface OAuthState {
  credentialId: string;
  tenantId: string;
  timestamp: number;
  redirectUrl?: string;
}

@Injectable()
export class OAuthService {
  private readonly stateStore = new Map<string, OAuthState>();
  private readonly stateExpiration = 10 * 60 * 1000; // 10 minutes

  constructor(
    @InjectRepository(Credential)
    private readonly credentialRepository: Repository<Credential>,
    @InjectRepository(OAuthToken)
    private readonly oauthTokenRepository: Repository<OAuthToken>,
    private readonly encryptionService: CredentialEncryptionService,
    private readonly configService: ConfigService,
  ) {
    // Clean up expired states every 5 minutes
    setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000);
  }

  /**
   * Start OAuth flow
   */
  async startFlow(
    credential: Credential,
    redirectUrl?: string,
  ): Promise<{ authUrl: string; state: string }> {
    const { oauthConfig } = credential.type;
    if (!oauthConfig) {
      throw new BadRequestException(
        "OAuth configuration not found for credential type",
      );
    }

    // Generate secure state
    const state = this.encryptionService.generateSecureRandomString();

    // Store state information
    this.stateStore.set(state, {
      credentialId: credential.id,
      tenantId: credential.tenantId,
      timestamp: Date.now(),
      redirectUrl,
    });

    // Build authorization URL
    const authUrl = this.buildAuthUrl(oauthConfig, state, redirectUrl);

    return { authUrl, state };
  }

  /**
   * Complete OAuth flow
   */
  async completeFlow(
    state: string,
    code: string,
    tenantId: string,
  ): Promise<CredentialResponseDto> {
    // Validate state
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new BadRequestException("Invalid or expired OAuth state");
    }

    if (stateData.tenantId !== tenantId) {
      throw new BadRequestException("Tenant mismatch in OAuth flow");
    }

    if (Date.now() - stateData.timestamp > this.stateExpiration) {
      this.stateStore.delete(state);
      throw new BadRequestException("OAuth state expired");
    }

    // Clean up state
    this.stateStore.delete(state);

    // Get credential
    const credential = await this.credentialRepository.findOne({
      where: { id: stateData.credentialId, tenantId },
      relations: ["type"],
    });

    if (!credential) {
      throw new NotFoundException("Credential not found");
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(credential, code);

    // Store tokens
    await this.storeTokens(credential, tokens);

    // Return updated credential (without sensitive data)
    return {
      id: credential.id,
      name: credential.name,
      description: credential.description,
      type: {
        id: credential.type.id,
        name: credential.type.name,
        displayName: credential.type.displayName,
        icon: credential.type.icon,
        oauth: credential.type.oauth,
      },
      isActive: credential.isActive,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      createdBy: credential.createdBy,
      updatedBy: credential.updatedBy,
    };
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(credential: Credential): Promise<CredentialResponseDto> {
    const oauthToken = await this.oauthTokenRepository.findOne({
      where: { credentialId: credential.id },
    });

    if (!oauthToken) {
      throw new NotFoundException("OAuth token not found");
    }

    // Decrypt refresh token
    const decryptedRefreshToken = await this.encryptionService.decrypt(
      oauthToken.refreshToken,
      credential.tenantId,
    );

    // Refresh tokens
    const newTokens = await this.refreshAccessToken(
      credential,
      decryptedRefreshToken,
    );

    // Update stored tokens
    await this.updateTokens(oauthToken, newTokens);

    // Return updated credential
    return {
      id: credential.id,
      name: credential.name,
      description: credential.description,
      type: {
        id: credential.type.id,
        name: credential.type.name,
        displayName: credential.type.displayName,
        icon: credential.type.icon,
        oauth: credential.type.oauth,
      },
      isActive: credential.isActive,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      createdBy: credential.createdBy,
      updatedBy: credential.updatedBy,
    };
  }

  /**
   * Build OAuth authorization URL
   */
  private buildAuthUrl(
    oauthConfig: any,
    state: string,
    redirectUrl?: string,
  ): string {
    const baseUrl = oauthConfig.authUrl;
    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: redirectUrl || oauthConfig.redirectUri,
      response_type: "code",
      state,
      scope: Array.isArray(oauthConfig.scopes)
        ? oauthConfig.scopes.join(" ")
        : oauthConfig.scopes,
    });

    // Add any additional parameters
    if (oauthConfig.additionalParams) {
      Object.entries(oauthConfig.additionalParams).forEach(([key, value]) => {
        params.append(key, value as string);
      });
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(
    credential: Credential,
    code: string,
  ): Promise<any> {
    const { oauthConfig } = credential.type;

    try {
      const response = await axios.post(
        oauthConfig.tokenUrl,
        {
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: oauthConfig.redirectUri,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to exchange code for tokens: ${error.message}`,
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(
    credential: Credential,
    refreshToken: string,
  ): Promise<any> {
    const { oauthConfig } = credential.type;

    try {
      const response = await axios.post(
        oauthConfig.tokenUrl,
        {
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to refresh token: ${error.message}`,
      );
    }
  }

  /**
   * Store OAuth tokens
   */
  private async storeTokens(
    credential: Credential,
    tokens: any,
  ): Promise<void> {
    // Encrypt tokens
    const encryptedAccessToken = await this.encryptionService.encrypt(
      tokens.access_token,
      credential.tenantId,
    );

    const encryptedRefreshToken = tokens.refresh_token
      ? await this.encryptionService.encrypt(
          tokens.refresh_token,
          credential.tenantId,
        )
      : null;

    // Calculate expiration date
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Create or update OAuth token record
    const existingToken = await this.oauthTokenRepository.findOne({
      where: { credentialId: credential.id },
    });

    if (existingToken) {
      existingToken.accessToken = encryptedAccessToken;
      existingToken.refreshToken = encryptedRefreshToken;
      existingToken.tokenType = tokens.token_type || "Bearer";
      existingToken.expiresIn = tokens.expires_in;
      existingToken.expiresAt = expiresAt;
      existingToken.scopes = tokens.scope ? tokens.scope.split(" ") : [];
      existingToken.updatedAt = new Date();

      await this.oauthTokenRepository.save(existingToken);
    } else {
      const oauthToken = this.oauthTokenRepository.create({
        credentialId: credential.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenType: tokens.token_type || "Bearer",
        expiresIn: tokens.expires_in,
        expiresAt,
        scopes: tokens.scope ? tokens.scope.split(" ") : [],
        tenantId: credential.tenantId,
      });

      await this.oauthTokenRepository.save(oauthToken);
    }
  }

  /**
   * Update existing OAuth tokens
   */
  private async updateTokens(
    oauthToken: OAuthToken,
    tokens: any,
  ): Promise<void> {
    const encryptedAccessToken = await this.encryptionService.encrypt(
      tokens.access_token,
      oauthToken.tenantId,
    );

    const encryptedRefreshToken = tokens.refresh_token
      ? await this.encryptionService.encrypt(
          tokens.refresh_token,
          oauthToken.tenantId,
        )
      : oauthToken.refreshToken;

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    oauthToken.accessToken = encryptedAccessToken;
    if (encryptedRefreshToken) {
      oauthToken.refreshToken = encryptedRefreshToken;
    }
    oauthToken.tokenType = tokens.token_type || oauthToken.tokenType;
    oauthToken.expiresIn = tokens.expires_in || oauthToken.expiresIn;
    oauthToken.expiresAt = expiresAt || oauthToken.expiresAt;
    oauthToken.updatedAt = new Date();

    await this.oauthTokenRepository.save(oauthToken);
  }

  /**
   * Clean up expired OAuth states
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.timestamp > this.stateExpiration) {
        this.stateStore.delete(state);
      }
    }
  }
}
