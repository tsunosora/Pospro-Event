import api from './client';

export const getSchedulePinStatus = async () =>
    (await api.get<{ isSet: boolean }>('/schedule-pin/status')).data;

export const verifySchedulePin = async (pin: string) =>
    (await api.post<{ ok: boolean }>('/schedule-pin/verify', { pin })).data;

export const setSchedulePin = async (pin: string) =>
    (await api.patch<{ ok: boolean }>('/schedule-pin', { pin })).data;
