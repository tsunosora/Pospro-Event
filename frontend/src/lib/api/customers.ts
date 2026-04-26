import api from './client';

export interface Customer {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    companyName: string | null;
    companyPIC: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface CustomerInput {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    companyName?: string | null;
    companyPIC?: string | null;
}

export const getCustomers = async () => (await api.get<Customer[]>('/customers')).data;
export const getCustomer = async (id: number) => (await api.get<Customer>(`/customers/${id}`)).data;
export const getCustomersWithStats = async () => (await api.get('/customers/with-stats')).data;
export const getCustomerAnalytics = async (id: number) => (await api.get(`/customers/${id}/analytics`)).data;
export const getCustomersExportData = async () => (await api.get('/customers/export-data')).data;
export const createCustomer = async (data: CustomerInput) =>
    (await api.post<Customer>('/customers', data)).data;
export const updateCustomer = async (id: number, data: Partial<CustomerInput>) =>
    (await api.patch<Customer>(`/customers/${id}`, data)).data;
export const deleteCustomer = async (id: number) => (await api.delete(`/customers/${id}`)).data;
