import * as jspb from 'google-protobuf'

import * as google_protobuf_timestamp_pb from 'google-protobuf/google/protobuf/timestamp_pb'; // proto import: "google/protobuf/timestamp.proto"


export class Error extends jspb.Message {
  getCode(): number;
  setCode(value: number): Error;

  getMessage(): string;
  setMessage(value: string): Error;

  getDetails(): string;
  setDetails(value: string): Error;

  getTimestamp(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setTimestamp(value?: google_protobuf_timestamp_pb.Timestamp): Error;
  hasTimestamp(): boolean;
  clearTimestamp(): Error;

  getMetadataMap(): jspb.Map<string, string>;
  clearMetadataMap(): Error;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Error.AsObject;
  static toObject(includeInstance: boolean, msg: Error): Error.AsObject;
  static serializeBinaryToWriter(message: Error, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Error;
  static deserializeBinaryFromReader(message: Error, reader: jspb.BinaryReader): Error;
}

export namespace Error {
  export type AsObject = {
    code: number,
    message: string,
    details: string,
    timestamp?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    metadataMap: Array<[string, string]>,
  }
}

export class PageRequest extends jspb.Message {
  getPageSize(): number;
  setPageSize(value: number): PageRequest;

  getPageToken(): string;
  setPageToken(value: string): PageRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PageRequest.AsObject;
  static toObject(includeInstance: boolean, msg: PageRequest): PageRequest.AsObject;
  static serializeBinaryToWriter(message: PageRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PageRequest;
  static deserializeBinaryFromReader(message: PageRequest, reader: jspb.BinaryReader): PageRequest;
}

export namespace PageRequest {
  export type AsObject = {
    pageSize: number,
    pageToken: string,
  }
}

export class PageResponse extends jspb.Message {
  getNextPageToken(): string;
  setNextPageToken(value: string): PageResponse;

  getTotalItems(): number;
  setTotalItems(value: number): PageResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PageResponse.AsObject;
  static toObject(includeInstance: boolean, msg: PageResponse): PageResponse.AsObject;
  static serializeBinaryToWriter(message: PageResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PageResponse;
  static deserializeBinaryFromReader(message: PageResponse, reader: jspb.BinaryReader): PageResponse;
}

export namespace PageResponse {
  export type AsObject = {
    nextPageToken: string,
    totalItems: number,
  }
}

export class HealthCheckRequest extends jspb.Message {
  getService(): string;
  setService(value: string): HealthCheckRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): HealthCheckRequest.AsObject;
  static toObject(includeInstance: boolean, msg: HealthCheckRequest): HealthCheckRequest.AsObject;
  static serializeBinaryToWriter(message: HealthCheckRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): HealthCheckRequest;
  static deserializeBinaryFromReader(message: HealthCheckRequest, reader: jspb.BinaryReader): HealthCheckRequest;
}

export namespace HealthCheckRequest {
  export type AsObject = {
    service: string,
  }
}

export class HealthCheckResponse extends jspb.Message {
  getStatus(): HealthCheckResponse.ServingStatus;
  setStatus(value: HealthCheckResponse.ServingStatus): HealthCheckResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): HealthCheckResponse.AsObject;
  static toObject(includeInstance: boolean, msg: HealthCheckResponse): HealthCheckResponse.AsObject;
  static serializeBinaryToWriter(message: HealthCheckResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): HealthCheckResponse;
  static deserializeBinaryFromReader(message: HealthCheckResponse, reader: jspb.BinaryReader): HealthCheckResponse;
}

export namespace HealthCheckResponse {
  export type AsObject = {
    status: HealthCheckResponse.ServingStatus,
  }

  export enum ServingStatus { 
    UNKNOWN = 0,
    SERVING = 1,
    NOT_SERVING = 2,
    SERVICE_UNKNOWN = 3,
  }
}

export class User extends jspb.Message {
  getUserId(): string;
  setUserId(value: string): User;

  getEmail(): string;
  setEmail(value: string): User;

  getName(): string;
  setName(value: string): User;

  getCreatedAt(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setCreatedAt(value?: google_protobuf_timestamp_pb.Timestamp): User;
  hasCreatedAt(): boolean;
  clearCreatedAt(): User;

  getMetadataMap(): jspb.Map<string, string>;
  clearMetadataMap(): User;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): User.AsObject;
  static toObject(includeInstance: boolean, msg: User): User.AsObject;
  static serializeBinaryToWriter(message: User, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): User;
  static deserializeBinaryFromReader(message: User, reader: jspb.BinaryReader): User;
}

export namespace User {
  export type AsObject = {
    userId: string,
    email: string,
    name: string,
    createdAt?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    metadataMap: Array<[string, string]>,
  }
}

export class Session extends jspb.Message {
  getSessionId(): string;
  setSessionId(value: string): Session;

  getUserId(): string;
  setUserId(value: string): Session;

  getCreatedAt(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setCreatedAt(value?: google_protobuf_timestamp_pb.Timestamp): Session;
  hasCreatedAt(): boolean;
  clearCreatedAt(): Session;

  getLastActivity(): google_protobuf_timestamp_pb.Timestamp | undefined;
  setLastActivity(value?: google_protobuf_timestamp_pb.Timestamp): Session;
  hasLastActivity(): boolean;
  clearLastActivity(): Session;

  getMetadataMap(): jspb.Map<string, string>;
  clearMetadataMap(): Session;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Session.AsObject;
  static toObject(includeInstance: boolean, msg: Session): Session.AsObject;
  static serializeBinaryToWriter(message: Session, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Session;
  static deserializeBinaryFromReader(message: Session, reader: jspb.BinaryReader): Session;
}

export namespace Session {
  export type AsObject = {
    sessionId: string,
    userId: string,
    createdAt?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    lastActivity?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    metadataMap: Array<[string, string]>,
  }
}

export enum ErrorCode { 
  ERROR_CODE_UNSPECIFIED = 0,
  ERROR_CODE_INVALID_REQUEST = 1,
  ERROR_CODE_NOT_FOUND = 2,
  ERROR_CODE_PERMISSION_DENIED = 3,
  ERROR_CODE_RATE_LIMITED = 4,
  ERROR_CODE_INTERNAL = 5,
  ERROR_CODE_UNAVAILABLE = 6,
  ERROR_CODE_TIMEOUT = 7,
}
