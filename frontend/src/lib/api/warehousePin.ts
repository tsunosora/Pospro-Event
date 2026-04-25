import api from './client';

export const getWarehousePinStatus = async () =>
    (await api.get<{ isSet: boolean }>('/warehouse-pin/status')).data;

export const verifyWarehousePin = async (pin: string) =>
    (await api.post<{ ok: boolean }>('/warehouse-pin/verify', { pin })).data;

export const setWarehousePin = async (pin: string) =>
    (await api.patch<{ ok: boolean }>('/warehouse-pin', { pin })).data;
