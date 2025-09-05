import * as jspb from 'google-protobuf'

import * as google_protobuf_timestamp_pb from 'google-protobuf/google/protobuf/timestamp_pb'; // proto import: "google/protobuf/timestamp.proto"
import * as google_protobuf_struct_pb from 'google-protobuf/google/protobuf/struct_pb'; // proto import: "google/protobuf/struct.proto"
import * as common_pb from './common_pb'; // proto import: "common.proto"


export class SendMessageRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): SendMessageRequest;

  getMessage(): string;
  setMessage(value: string): SendMessageRequest;

  getContextMap(): jspb.Map<string, string>;
  clearContextMap(): SendMessageRequest;

  getOptions(): MessageOptions | undefined;
  setOptions(value?: MessageOptions): SendMessageRequest;
  hasOptions(): boolean;
  clearOptions(): SendMessageRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SendMessageRequest.AsObject;
  static toObject(includeInstance: boolean, msg: SendMessageRequest): SendMessageRequest.AsObject;
  static serializeBinaryToWriter(message: SendMessageRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SendMessageRequest;
  static deserializeBinaryFromReader(message: SendMessageRequest, reader: jspb.BinaryReader): SendMessageRequest;
}

export namespace SendMessageRequest {
  export type AsObject = {
    sessionId: string,
    message: string,
    contextMap: Array<[string, string]>,
    options?: MessageOptions.AsObject,
  }
}

export class MessageOptions extends jspb.Message {
  getStream(): boolean;
  setStream(value: boolean): MessageOptions;

  getPreferredConnector(): string;
  setPreferredConnector(value: string): MessageOptions;

  getMaxTokens(): number;
  setMaxTokens(value: number): MessageOptions;

  getTemperature(): number;
  setTemperature(value: number): MessageOptions;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MessageOptions.AsObject;
  static toObject(includeInstance: boolean, msg: MessageOptions): MessageOptions.AsObject;
  static serializeBinaryToWriter(message: MessageOptions, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MessageOptions;
  static deserializeBinaryFromReader(message: MessageOptions, reader: jspb.BinaryReader): MessageOptions;
}

export namespace MessageOptions {
  export type AsObject = {
    stream: boolean,
    preferredConnector: string,
    maxTokens: number,
    temperature: number,
  }
}

export class SendMessageResponse extends jspb.Message {
  getResponseId(): string;
  setResponseId(value: string): SendMessageResponse;

  getContent(): string;
  setContent(value: string): SendMessageResponse;

  getWidgetsList(): Array<Widget>;
  setWidgetsList(value: Array<Widget>): SendMessageResponse;
  clearWidgetsList(): SendMessageResponse;
  addWidgets(value?: Widget, index?: number): Widget;

  getSuggestedActionsList(): Array<Action>;
  setSuggestedActionsList(value: Array<Action>): SendMessageResponse;
  clearSuggestedActionsList(): SendMessageResponse;
  addSuggestedActions(value?: Action, index?: number): Action;

  getMetadata(): ResponseMetadata | undefined;
  setMetadata(value?: ResponseMetadata): SendMessageResponse;
  hasMetadata(): boolean;
  clearMetadata(): SendMessageResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SendMessageResponse.AsObject;
  static toObject(includeInstance: boolean, msg: SendMessageResponse): SendMessageResponse.AsObject;
  static serializeBinaryToWriter(message: SendMessageResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SendMessageResponse;
  static deserializeBinaryFromReader(message: SendMessageResponse, reader: jspb.BinaryReader): SendMessageResponse;
}

export namespace SendMessageResponse {
  export type AsObject = {
    responseId: string,
    content: string,
    widgetsList: Array<Widget.AsObject>,
    suggestedActionsList: Array<Action.AsObject>,
    metadata?: ResponseMetadata.AsObject,
  }
}

export class Widget extends jspb.Message {
  getType(): string;
  setType(value: string): Widget;

  getWidgetId(): string;
  setWidgetId(value: string): Widget;

  getConfig(): google_protobuf_struct_pb.Struct | undefined;
  setConfig(value?: google_protobuf_struct_pb.Struct): Widget;
  hasConfig(): boolean;
  clearConfig(): Widget;

  getData(): google_protobuf_struct_pb.Struct | undefined;
  setData(value?: google_protobuf_struct_pb.Struct): Widget;
  hasData(): boolean;
  clearData(): Widget;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Widget.AsObject;
  static toObject(includeInstance: boolean, msg: Widget): Widget.AsObject;
  static serializeBinaryToWriter(message: Widget, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Widget;
  static deserializeBinaryFromReader(message: Widget, reader: jspb.BinaryReader): Widget;
}

export namespace Widget {
  export type AsObject = {
    type: string,
    widgetId: string,
    config?: google_protobuf_struct_pb.Struct.AsObject,
    data?: google_protobuf_struct_pb.Struct.AsObject,
  }
}

export class Action extends jspb.Message {
  getActionId(): string;
  setActionId(value: string): Action;

  getLabel(): string;
  setLabel(value: string): Action;

  getDescription(): string;
  setDescription(value: string): Action;

  getType(): ActionType;
  setType(value: ActionType): Action;

  getParamsMap(): jspb.Map<string, string>;
  clearParamsMap(): Action;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Action.AsObject;
  static toObject(includeInstance: boolean, msg: Action): Action.AsObject;
  static serializeBinaryToWriter(message: Action, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Action;
  static deserializeBinaryFromReader(message: Action, reader: jspb.BinaryReader): Action;
}

export namespace Action {
  export type AsObject = {
    actionId: string,
    label: string,
    description: string,
    type: ActionType,
    paramsMap: Array<[string, string]>,
  }
}

export class ResponseMetadata extends jspb.Message {
  getTimestamp(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setTimestamp(value?: google_protobuf_timestamp_pb.Timestamp): ResponseMetadata;
  hasTimestamp(): boolean;
  clearTimestamp(): ResponseMetadata;

  getTokensUsed(): number;
  setTokensUsed(value: number): ResponseMetadata;

  getProcessingTime(): number;
  setProcessingTime(value: number): ResponseMetadata;

  getModelUsed(): string;
  setModelUsed(value: string): ResponseMetadata;

  getExtraMap(): jspb.Map<string, string>;
  clearExtraMap(): ResponseMetadata;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ResponseMetadata.AsObject;
  static toObject(includeInstance: boolean, msg: ResponseMetadata): ResponseMetadata.AsObject;
  static serializeBinaryToWriter(message: ResponseMetadata, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ResponseMetadata;
  static deserializeBinaryFromReader(message: ResponseMetadata, reader: jspb.BinaryReader): ResponseMetadata;
}

export namespace ResponseMetadata {
  export type AsObject = {
    timestamp?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    tokensUsed: number,
    processingTime: number,
    modelUsed: string,
    extraMap: Array<[string, string]>,
  }
}

export class StreamRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): StreamRequest;

  getIncludeWidgets(): boolean;
  setIncludeWidgets(value: boolean): StreamRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): StreamRequest.AsObject;
  static toObject(includeInstance: boolean, msg: StreamRequest): StreamRequest.AsObject;
  static serializeBinaryToWriter(message: StreamRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): StreamRequest;
  static deserializeBinaryFromReader(message: StreamRequest, reader: jspb.BinaryReader): StreamRequest;
}

export namespace StreamRequest {
  export type AsObject = {
    sessionId: string,
    includeWidgets: boolean,
  }
}

export class StreamResponse extends jspb.Message {
  getChunkId(): string;
  setChunkId(value: string): StreamResponse;

  getContent(): string;
  setContent(value: string): StreamResponse;

  getIsFinal(): boolean;
  setIsFinal(value: boolean): StreamResponse;

  getWidgetsList(): Array<Widget>;
  setWidgetsList(value: Array<Widget>): StreamResponse;
  clearWidgetsList(): StreamResponse;
  addWidgets(value?: Widget, index?: number): Widget;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): StreamResponse.AsObject;
  static toObject(includeInstance: boolean, msg: StreamResponse): StreamResponse.AsObject;
  static serializeBinaryToWriter(message: StreamResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): StreamResponse;
  static deserializeBinaryFromReader(message: StreamResponse, reader: jspb.BinaryReader): StreamResponse;
}

export namespace StreamResponse {
  export type AsObject = {
    chunkId: string,
    content: string,
    isFinal: boolean,
    widgetsList: Array<Widget.AsObject>,
  }
}

export class GetHistoryRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): GetHistoryRequest;

  getLimit(): number;
  setLimit(value: number): GetHistoryRequest;

  getOffset(): number;
  setOffset(value: number): GetHistoryRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetHistoryRequest.AsObject;
  static toObject(includeInstance: boolean, msg: GetHistoryRequest): GetHistoryRequest.AsObject;
  static serializeBinaryToWriter(message: GetHistoryRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetHistoryRequest;
  static deserializeBinaryFromReader(message: GetHistoryRequest, reader: jspb.BinaryReader): GetHistoryRequest;
}

export namespace GetHistoryRequest {
  export type AsObject = {
    sessionId: string,
    limit: number,
    offset: number,
  }
}

export class GetHistoryResponse extends jspb.Message {
  getMessagesList(): Array<ChatMessage>;
  setMessagesList(value: Array<ChatMessage>): GetHistoryResponse;
  clearMessagesList(): GetHistoryResponse;
  addMessages(value?: ChatMessage, index?: number): ChatMessage;

  getTotalCount(): number;
  setTotalCount(value: number): GetHistoryResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetHistoryResponse.AsObject;
  static toObject(includeInstance: boolean, msg: GetHistoryResponse): GetHistoryResponse.AsObject;
  static serializeBinaryToWriter(message: GetHistoryResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetHistoryResponse;
  static deserializeBinaryFromReader(message: GetHistoryResponse, reader: jspb.BinaryReader): GetHistoryResponse;
}

export namespace GetHistoryResponse {
  export type AsObject = {
    messagesList: Array<ChatMessage.AsObject>,
    totalCount: number,
  }
}

export class ChatMessage extends jspb.Message {
  getMessageId(): string;
  setMessageId(value: string): ChatMessage;

  getSessionId(): string;
  setSessionId(value: string): ChatMessage;

  getSender(): string;
  setSender(value: string): ChatMessage;

  getContent(): string;
  setContent(value: string): ChatMessage;

  getTimestamp(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setTimestamp(value?: google_protobuf_timestamp_pb.Timestamp): ChatMessage;
  hasTimestamp(): boolean;
  clearTimestamp(): ChatMessage;

  getWidgetsList(): Array<Widget>;
  setWidgetsList(value: Array<Widget>): ChatMessage;
  clearWidgetsList(): ChatMessage;
  addWidgets(value?: Widget, index?: number): Widget;

  getMetadataMap(): jspb.Map<string, string>;
  clearMetadataMap(): ChatMessage;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ChatMessage.AsObject;
  static toObject(includeInstance: boolean, msg: ChatMessage): ChatMessage.AsObject;
  static serializeBinaryToWriter(message: ChatMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ChatMessage;
  static deserializeBinaryFromReader(message: ChatMessage, reader: jspb.BinaryReader): ChatMessage;
}

export namespace ChatMessage {
  export type AsObject = {
    messageId: string,
    sessionId: string,
    sender: string,
    content: string,
    timestamp?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    widgetsList: Array<Widget.AsObject>,
    metadataMap: Array<[string, string]>,
  }
}

export class CreateSessionRequest extends jspb.Message {
  getUserId(): string;
  setUserId(value: string): CreateSessionRequest;

  getMetadataMap(): jspb.Map<string, string>;
  clearMetadataMap(): CreateSessionRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CreateSessionRequest.AsObject;
  static toObject(includeInstance: boolean, msg: CreateSessionRequest): CreateSessionRequest.AsObject;
  static serializeBinaryToWriter(message: CreateSessionRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CreateSessionRequest;
  static deserializeBinaryFromReader(message: CreateSessionRequest, reader: jspb.BinaryReader): CreateSessionRequest;
}

export namespace CreateSessionRequest {
  export type AsObject = {
    userId: string,
    metadataMap: Array<[string, string]>,
  }
}

export class CreateSessionResponse extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): CreateSessionResponse;

  getCreatedAt(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setCreatedAt(value?: google_protobuf_timestamp_pb.Timestamp): CreateSessionResponse;
  hasCreatedAt(): boolean;
  clearCreatedAt(): CreateSessionResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CreateSessionResponse.AsObject;
  static toObject(includeInstance: boolean, msg: CreateSessionResponse): CreateSessionResponse.AsObject;
  static serializeBinaryToWriter(message: CreateSessionResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CreateSessionResponse;
  static deserializeBinaryFromReader(message: CreateSessionResponse, reader: jspb.BinaryReader): CreateSessionResponse;
}

export namespace CreateSessionResponse {
  export type AsObject = {
    sessionId: string,
    createdAt?: google_protobuf_timestamp_pb.Timestamp.AsObject,
  }
}

export class EndSessionRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): EndSessionRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): EndSessionRequest.AsObject;
  static toObject(includeInstance: boolean, msg: EndSessionRequest): EndSessionRequest.AsObject;
  static serializeBinaryToWriter(message: EndSessionRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): EndSessionRequest;
  static deserializeBinaryFromReader(message: EndSessionRequest, reader: jspb.BinaryReader): EndSessionRequest;
}

export namespace EndSessionRequest {
  export type AsObject = {
    sessionId: string,
  }
}

export class EndSessionResponse extends jspb.Message {
  getSuccess(): boolean;
  setSuccess(value: boolean): EndSessionResponse;

  getEndedAt(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setEndedAt(value?: google_protobuf_timestamp_pb.Timestamp): EndSessionResponse;
  hasEndedAt(): boolean;
  clearEndedAt(): EndSessionResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): EndSessionResponse.AsObject;
  static toObject(includeInstance: boolean, msg: EndSessionResponse): EndSessionResponse.AsObject;
  static serializeBinaryToWriter(message: EndSessionResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): EndSessionResponse;
  static deserializeBinaryFromReader(message: EndSessionResponse, reader: jspb.BinaryReader): EndSessionResponse;
}

export namespace EndSessionResponse {
  export type AsObject = {
    success: boolean,
    endedAt?: google_protobuf_timestamp_pb.Timestamp.AsObject,
  }
}

export class ExecuteCodeRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): ExecuteCodeRequest;

  getLanguage(): string;
  setLanguage(value: string): ExecuteCodeRequest;

  getCode(): string;
  setCode(value: string): ExecuteCodeRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ExecuteCodeRequest.AsObject;
  static toObject(includeInstance: boolean, msg: ExecuteCodeRequest): ExecuteCodeRequest.AsObject;
  static serializeBinaryToWriter(message: ExecuteCodeRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ExecuteCodeRequest;
  static deserializeBinaryFromReader(message: ExecuteCodeRequest, reader: jspb.BinaryReader): ExecuteCodeRequest;
}

export namespace ExecuteCodeRequest {
  export type AsObject = {
    sessionId: string,
    language: string,
    code: string,
  }
}

export class ExecuteCodeResponse extends jspb.Message {
  getOutput(): string;
  setOutput(value: string): ExecuteCodeResponse;

  getError(): boolean;
  setError(value: boolean): ExecuteCodeResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ExecuteCodeResponse.AsObject;
  static toObject(includeInstance: boolean, msg: ExecuteCodeResponse): ExecuteCodeResponse.AsObject;
  static serializeBinaryToWriter(message: ExecuteCodeResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ExecuteCodeResponse;
  static deserializeBinaryFromReader(message: ExecuteCodeResponse, reader: jspb.BinaryReader): ExecuteCodeResponse;
}

export namespace ExecuteCodeResponse {
  export type AsObject = {
    output: string,
    error: boolean,
  }
}

export class SubmitFormRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): SubmitFormRequest;

  getWidgetId(): string;
  setWidgetId(value: string): SubmitFormRequest;

  getFormData(): google_protobuf_struct_pb.Struct | undefined;
  setFormData(value?: google_protobuf_struct_pb.Struct): SubmitFormRequest;
  hasFormData(): boolean;
  clearFormData(): SubmitFormRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SubmitFormRequest.AsObject;
  static toObject(includeInstance: boolean, msg: SubmitFormRequest): SubmitFormRequest.AsObject;
  static serializeBinaryToWriter(message: SubmitFormRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SubmitFormRequest;
  static deserializeBinaryFromReader(message: SubmitFormRequest, reader: jspb.BinaryReader): SubmitFormRequest;
}

export namespace SubmitFormRequest {
  export type AsObject = {
    sessionId: string,
    widgetId: string,
    formData?: google_protobuf_struct_pb.Struct.AsObject,
  }
}

export class SubmitFormResponse extends jspb.Message {
  getSuccess(): boolean;
  setSuccess(value: boolean): SubmitFormResponse;

  getMessage(): string;
  setMessage(value: string): SubmitFormResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SubmitFormResponse.AsObject;
  static toObject(includeInstance: boolean, msg: SubmitFormResponse): SubmitFormResponse.AsObject;
  static serializeBinaryToWriter(message: SubmitFormResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SubmitFormResponse;
  static deserializeBinaryFromReader(message: SubmitFormResponse, reader: jspb.BinaryReader): SubmitFormResponse;
}

export namespace SubmitFormResponse {
  export type AsObject = {
    success: boolean,
    message: string,
  }
}

export class SubmitQuizAnswerRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): SubmitQuizAnswerRequest;

  getWidgetId(): string;
  setWidgetId(value: string): SubmitQuizAnswerRequest;

  getSelectedOptionIndex(): number;
  setSelectedOptionIndex(value: number): SubmitQuizAnswerRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SubmitQuizAnswerRequest.AsObject;
  static toObject(includeInstance: boolean, msg: SubmitQuizAnswerRequest): SubmitQuizAnswerRequest.AsObject;
  static serializeBinaryToWriter(message: SubmitQuizAnswerRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SubmitQuizAnswerRequest;
  static deserializeBinaryFromReader(message: SubmitQuizAnswerRequest, reader: jspb.BinaryReader): SubmitQuizAnswerRequest;
}

export namespace SubmitQuizAnswerRequest {
  export type AsObject = {
    sessionId: string,
    widgetId: string,
    selectedOptionIndex: number,
  }
}

export class SubmitQuizAnswerResponse extends jspb.Message {
  getCorrect(): boolean;
  setCorrect(value: boolean): SubmitQuizAnswerResponse;

  getFeedback(): string;
  setFeedback(value: string): SubmitQuizAnswerResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SubmitQuizAnswerResponse.AsObject;
  static toObject(includeInstance: boolean, msg: SubmitQuizAnswerResponse): SubmitQuizAnswerResponse.AsObject;
  static serializeBinaryToWriter(message: SubmitQuizAnswerResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SubmitQuizAnswerResponse;
  static deserializeBinaryFromReader(message: SubmitQuizAnswerResponse, reader: jspb.BinaryReader): SubmitQuizAnswerResponse;
}

export namespace SubmitQuizAnswerResponse {
  export type AsObject = {
    correct: boolean,
    feedback: string,
  }
}

export class GetFileTreeRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): GetFileTreeRequest;

  getPath(): string;
  setPath(value: string): GetFileTreeRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetFileTreeRequest.AsObject;
  static toObject(includeInstance: boolean, msg: GetFileTreeRequest): GetFileTreeRequest.AsObject;
  static serializeBinaryToWriter(message: GetFileTreeRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetFileTreeRequest;
  static deserializeBinaryFromReader(message: GetFileTreeRequest, reader: jspb.BinaryReader): GetFileTreeRequest;
}

export namespace GetFileTreeRequest {
  export type AsObject = {
    sessionId: string,
    path: string,
  }
}

export class GetFileTreeResponse extends jspb.Message {
  getRoot(): FileTreeNode | undefined;
  setRoot(value?: FileTreeNode): GetFileTreeResponse;
  hasRoot(): boolean;
  clearRoot(): GetFileTreeResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetFileTreeResponse.AsObject;
  static toObject(includeInstance: boolean, msg: GetFileTreeResponse): GetFileTreeResponse.AsObject;
  static serializeBinaryToWriter(message: GetFileTreeResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetFileTreeResponse;
  static deserializeBinaryFromReader(message: GetFileTreeResponse, reader: jspb.BinaryReader): GetFileTreeResponse;
}

export namespace GetFileTreeResponse {
  export type AsObject = {
    root?: FileTreeNode.AsObject,
  }
}

export class FileTreeNode extends jspb.Message {
  getName(): string;
  setName(value: string): FileTreeNode;

  getIsDirectory(): boolean;
  setIsDirectory(value: boolean): FileTreeNode;

  getChildrenList(): Array<FileTreeNode>;
  setChildrenList(value: Array<FileTreeNode>): FileTreeNode;
  clearChildrenList(): FileTreeNode;
  addChildren(value?: FileTreeNode, index?: number): FileTreeNode;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): FileTreeNode.AsObject;
  static toObject(includeInstance: boolean, msg: FileTreeNode): FileTreeNode.AsObject;
  static serializeBinaryToWriter(message: FileTreeNode, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): FileTreeNode;
  static deserializeBinaryFromReader(message: FileTreeNode, reader: jspb.BinaryReader): FileTreeNode;
}

export namespace FileTreeNode {
  export type AsObject = {
    name: string,
    isDirectory: boolean,
    childrenList: Array<FileTreeNode.AsObject>,
  }
}

export class MediaInteractionRequest extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): MediaInteractionRequest;

  getWidgetId(): string;
  setWidgetId(value: string): MediaInteractionRequest;

  getMediaUrl(): string;
  setMediaUrl(value: string): MediaInteractionRequest;

  getAction(): string;
  setAction(value: string): MediaInteractionRequest;

  getMetadata(): google_protobuf_struct_pb.Struct | undefined;
  setMetadata(value?: google_protobuf_struct_pb.Struct): MediaInteractionRequest;
  hasMetadata(): boolean;
  clearMetadata(): MediaInteractionRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MediaInteractionRequest.AsObject;
  static toObject(includeInstance: boolean, msg: MediaInteractionRequest): MediaInteractionRequest.AsObject;
  static serializeBinaryToWriter(message: MediaInteractionRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MediaInteractionRequest;
  static deserializeBinaryFromReader(message: MediaInteractionRequest, reader: jspb.BinaryReader): MediaInteractionRequest;
}

export namespace MediaInteractionRequest {
  export type AsObject = {
    sessionId: string,
    widgetId: string,
    mediaUrl: string,
    action: string,
    metadata?: google_protobuf_struct_pb.Struct.AsObject,
  }
}

export class MediaInteractionResponse extends jspb.Message {
  getSuccess(): boolean;
  setSuccess(value: boolean): MediaInteractionResponse;

  getMessage(): string;
  setMessage(value: string): MediaInteractionResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MediaInteractionResponse.AsObject;
  static toObject(includeInstance: boolean, msg: MediaInteractionResponse): MediaInteractionResponse.AsObject;
  static serializeBinaryToWriter(message: MediaInteractionResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MediaInteractionResponse;
  static deserializeBinaryFromReader(message: MediaInteractionResponse, reader: jspb.BinaryReader): MediaInteractionResponse;
}

export namespace MediaInteractionResponse {
  export type AsObject = {
    success: boolean,
    message: string,
  }
}

export enum ActionType { 
  ACTION_TYPE_UNSPECIFIED = 0,
  ACTION_TYPE_NAVIGATE = 1,
  ACTION_TYPE_EXECUTE = 2,
  ACTION_TYPE_EXPAND = 3,
  ACTION_TYPE_EXTERNAL = 4,
}
