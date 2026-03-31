import api from './client';

// Transactions
export const getTransactions = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    return (await api.get(`/transactions${query ? `?${query}` : ''}`)).data;
};
export const getTransactionById = async (id: number) => (await api.get(`/transactions/${id}`)).data;
export const createTransaction = async (data: {
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number;
        heightCm?: number;
        unitType?: string;
        note?: string;
        customPrice?: number;
    }[];
    paymentMethod: 'CASH' | 'QRIS' | 'BANK_TRANSFER';
    discount?: number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    dueDate?: string;
    downPayment?: number;
    cashierName?: string;
    employeeName?: string;
    bankAccountId?: number;
    productionPriority?: 'NORMAL' | 'EXPRESS';
    productionDeadline?: string;
    productionNotes?: string;
}) => (await api.post('/transactions', data)).data;
export const payOffTransaction = async (id: number, data: { paymentMethod: string, bankAccountId?: number }) =>
    (await api.post(`/transactions/${id}/pay-off`, data)).data;
export const updateTransactionPaymentMethod = async (id: number, data: { paymentMethod: string; bankAccountId?: number }) =>
    (await api.patch(`/transactions/${id}/payment-method`, data)).data;

// Bank Accounts
export const getBankAccounts = async () => (await api.get('/bank-accounts')).data;
export const createBankAccount = async (data: any) => (await api.post('/bank-accounts', data)).data;
export const updateBankAccount = async (id: number, data: any) => (await api.patch(`/bank-accounts/${id}`, data)).data;
export const deleteBankAccount = async (id: number) => (await api.delete(`/bank-accounts/${id}`)).data;
export const resetBankBalance = async (id: number, newBalance: number) =>
    (await api.patch(`/bank-accounts/${id}/reset-balance`, { newBalance })).data;
