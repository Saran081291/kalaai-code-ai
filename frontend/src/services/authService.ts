import { api } from '@/services/api';
import type {
  LoginRequest,
  RegisterRequest,
  TokenPair,
  UpdateProfileRequest,
  User,
} from '@/types';

export const authService = {
  async login(body: LoginRequest): Promise<TokenPair> {
    const { data } = await api.post<TokenPair>('/auth/login', body);
    return data;
  },

  async register(body: RegisterRequest): Promise<TokenPair> {
    const { data } = await api.post<TokenPair>('/auth/register', body);
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  async updateMe(body: UpdateProfileRequest): Promise<User> {
    const { data } = await api.put<User>('/auth/me', body);
    return data;
  },
};
