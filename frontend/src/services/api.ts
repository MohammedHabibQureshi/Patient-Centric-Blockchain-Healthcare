import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

class ApiService {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
              if (refreshResponse.data?.tokens) {
                const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.tokens;
                this.setTokens(accessToken, newRefreshToken);
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                }
                return this.client(originalRequest);
              }
            }
          } catch (refreshError) {
            // Refresh failed, fall through to logout below
          }
          
          this.clearAuth();
          window.location.href = '/login';
        }
        
        return Promise.reject(error);
      }
    );
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearAuth(): void {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  initializeFromStorage(): void {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      this.accessToken = accessToken;
    }
  }

  async getNonce(walletAddress: string): Promise<{ nonce: string; message: string; walletAddress: string }> {
    const response = await this.client.post('/auth/nonce', { walletAddress });
    return response.data;
  }

  async verifyWalletAuth(walletAddress: string, signature: string, message: string): Promise<{ user: any; tokens: { accessToken: string; refreshToken: string } }> {
    const response = await this.client.post('/auth/verify', { walletAddress, signature, message });
    return response.data;
  }

  async getCurrentUser(): Promise<any> {
    const response = await this.client.get('/auth/me');
    return response.data.user;
  }

  async registerPatient(
    dataOrAddress: { walletAddress: string; name: string; email: string; patientId: string } | string,
    name?: string,
    email?: string,
    patientId?: string
  ): Promise<any> {
    if (typeof dataOrAddress === 'object') {
      const response = await this.client.post('/users/patients', dataOrAddress);
      return response.data;
    } else {
      const response = await this.client.post('/users/patients', {
        walletAddress: dataOrAddress,
        name,
        email,
        patientId
      });
      return response.data;
    }
  }

  async registerDoctor(
    dataOrAddress: { walletAddress: string; name: string; email: string; licenseNumber: string } | string,
    name?: string,
    email?: string,
    licenseNumber?: string
  ): Promise<any> {
    if (typeof dataOrAddress === 'object') {
      const response = await this.client.post('/users/doctors', dataOrAddress);
      return response.data;
    } else {
      const response = await this.client.post('/users/doctors', {
        walletAddress: dataOrAddress,
        name,
        email,
        licenseNumber
      });
      return response.data;
    }
  }

  async deactivateUser(walletAddress: string): Promise<any> {
    const response = await this.client.post('/users/deactivate', { walletAddress });
    return response.data;
  }

  async reactivateUser(walletAddress: string): Promise<any> {
    const response = await this.client.post('/users/reactivate', { walletAddress });
    return response.data;
  }

  async getUsers(params?: { role?: string; status?: string; page?: number; limit?: number }): Promise<any> {
    const response = await this.client.get('/users', { params });
    return response.data;
  }

  async getPatients(): Promise<{ patients: any[] }> {
    const response = await this.client.get('/users/patients');
    return response.data;
  }

  async getDoctors(): Promise<{ doctors: any[] }> {
    const response = await this.client.get('/users/doctors');
    return response.data;
  }

  async getDoctorsList(): Promise<{ doctors: any[] }> {
    const response = await this.client.get('/users/doctors/list');
    return response.data;
  }

  async getAllUsers(): Promise<{ users: any[] }> {
    const response = await this.client.get('/users');
    return response.data;
  }

  async getUsersByRole(role: string): Promise<{ users: any[] }> {
    const response = await this.client.get('/users', { params: { role } });
    return response.data;
  }

  async getUserByWallet(walletAddress: string): Promise<{ user: any; blockchainUser?: any }> {
    const response = await this.client.get(`/users/${walletAddress}`);
    return response.data;
  }

  async getDashboardStats(): Promise<any> {
    const response = await this.client.get('/dashboard/stats');
    return response.data;
  }

  async uploadRecord(file: File, recordType: string, recordName: string, onProgress?: (progress: number) => void): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recordType', recordType);
    formData.append('recordName', recordName);

    const response = await this.client.post('/records', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      }
    });
    return response.data;
  }

  async getMyRecords(): Promise<{ records: any[] }> {
    const response = await this.client.get('/records');
    return response.data;
  }

  async getRecordById(recordId: string): Promise<{ record: any; blockchainRecord?: any }> {
    const response = await this.client.get(`/records/${recordId}`);
    return response.data;
  }

  async downloadRecord(recordId: string): Promise<Blob> {
    const response = await this.client.get(`/records/${recordId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async verifyRecordIntegrity(recordId: string): Promise<any> {
    const response = await this.client.get(`/records/${recordId}/verify`);
    return response.data;
  }

  async requestAccess(data: { 
    patientWalletAddress: string; 
    recordId?: string; 
    accessLevel: number; 
    reason: string; 
    purpose: string; 
    expiresInHours?: number 
  }): Promise<any> {
    const response = await this.client.post('/access/request', data);
    return response.data;
  }

  async getMyAccessRequests(): Promise<{ requests: any[] }> {
    const response = await this.client.get('/access/requests');
    return response.data;
  }

  async approveAccess(requestId: string): Promise<{ txHash: string }> {
    const response = await this.client.post(`/access/requests/${requestId}/approve`);
    return response.data;
  }

  async denyAccess(requestId: string): Promise<{ txHash: string }> {
    const response = await this.client.post(`/access/requests/${requestId}/deny`);
    return response.data;
  }

  async revokeAccess(requestId: string): Promise<{ txHash: string }> {
    const response = await this.client.post(`/access/requests/${requestId}/revoke`);
    return response.data;
  }

  async checkAccess(patientWalletAddress: string, recordId?: string): Promise<any> {
    const response = await this.client.get('/access/check', {
      params: { patientWalletAddress, recordId }
    });
    return response.data;
  }

  async getAuthorizedRecords(): Promise<{ records: any[] }> {
    const response = await this.client.get('/access/authorized');
    return response.data;
  }

  // Patient-to-Doctor Access Request methods
  async requestDoctorAccess(data: { doctorWalletAddress: string; reason: string; purpose: string }): Promise<any> {
    const response = await this.client.post('/patient-access/request', data);
    return response.data;
  }

  async getMyPatientRequests(): Promise<{ requests: any[] }> {
    const response = await this.client.get('/patient-access/my-requests');
    return response.data;
  }

  async getDoctorPatientRequests(): Promise<{ requests: any[] }> {
    const response = await this.client.get('/patient-access/doctor-requests');
    return response.data;
  }

  async acceptPatientRequest(requestId: string): Promise<any> {
    const response = await this.client.post(`/patient-access/${requestId}/accept`);
    return response.data;
  }

  async rejectPatientRequest(requestId: string): Promise<any> {
    const response = await this.client.post(`/patient-access/${requestId}/reject`);
    return response.data;
  }

  async getAuthorizedPatients(): Promise<{ patients: any[] }> {
    const response = await this.client.get('/patient-access/authorized-patients');
    return response.data;
  }

  async getConnectedPatients(): Promise<{ patients: any[] }> {
    const response = await this.client.get('/patient-access/connected-patients');
    return response.data;
  }

  async checkPatientAuthorization(doctorWallet: string): Promise<{ isAuthorized: boolean; status: string }> {
    const response = await this.client.get(`/patient-access/check/${doctorWallet}`);
    return response.data;
  }

  async getAuditLogs(params?: { 
    action?: string; 
    actorWallet?: string; 
    targetType?: string; 
    targetId?: string; 
    page?: number; 
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const response = await this.client.get('/audit/logs', { params });
    return response.data;
  }

  async getAuditLogById(logId: string): Promise<any> {
    const response = await this.client.get(`/audit/logs/${logId}`);
    return response.data;
  }

  async getActorAuditLogs(walletAddress: string): Promise<any> {
    const response = await this.client.get(`/audit/actor/${walletAddress}`);
    return response.data;
  }

  async getSystemHealth(): Promise<any> {
    const response = await this.client.get('/audit/health');
    return response.data;
  }

  async getPublicSystemHealth(): Promise<any> {
    const response = await this.client.get('/system/health');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
