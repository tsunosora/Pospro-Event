export class ChatTurnDto {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatDto {
  message: string;
  history?: ChatTurnDto[];
}
