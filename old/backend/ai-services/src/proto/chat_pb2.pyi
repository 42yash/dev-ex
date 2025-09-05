from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import struct_pb2 as _struct_pb2
import common_pb2 as _common_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ActionType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ACTION_TYPE_UNSPECIFIED: _ClassVar[ActionType]
    ACTION_TYPE_NAVIGATE: _ClassVar[ActionType]
    ACTION_TYPE_EXECUTE: _ClassVar[ActionType]
    ACTION_TYPE_EXPAND: _ClassVar[ActionType]
    ACTION_TYPE_EXTERNAL: _ClassVar[ActionType]
ACTION_TYPE_UNSPECIFIED: ActionType
ACTION_TYPE_NAVIGATE: ActionType
ACTION_TYPE_EXECUTE: ActionType
ACTION_TYPE_EXPAND: ActionType
ACTION_TYPE_EXTERNAL: ActionType

class SendMessageRequest(_message.Message):
    __slots__ = ("session_id", "message", "context", "options")
    class ContextEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    OPTIONS_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    message: str
    context: _containers.ScalarMap[str, str]
    options: MessageOptions
    def __init__(self, session_id: _Optional[str] = ..., message: _Optional[str] = ..., context: _Optional[_Mapping[str, str]] = ..., options: _Optional[_Union[MessageOptions, _Mapping]] = ...) -> None: ...

class MessageOptions(_message.Message):
    __slots__ = ("stream", "preferred_connector", "max_tokens", "temperature")
    STREAM_FIELD_NUMBER: _ClassVar[int]
    PREFERRED_CONNECTOR_FIELD_NUMBER: _ClassVar[int]
    MAX_TOKENS_FIELD_NUMBER: _ClassVar[int]
    TEMPERATURE_FIELD_NUMBER: _ClassVar[int]
    stream: bool
    preferred_connector: str
    max_tokens: int
    temperature: float
    def __init__(self, stream: bool = ..., preferred_connector: _Optional[str] = ..., max_tokens: _Optional[int] = ..., temperature: _Optional[float] = ...) -> None: ...

class SendMessageResponse(_message.Message):
    __slots__ = ("response_id", "content", "widgets", "suggested_actions", "metadata")
    RESPONSE_ID_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    WIDGETS_FIELD_NUMBER: _ClassVar[int]
    SUGGESTED_ACTIONS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    response_id: str
    content: str
    widgets: _containers.RepeatedCompositeFieldContainer[Widget]
    suggested_actions: _containers.RepeatedCompositeFieldContainer[Action]
    metadata: ResponseMetadata
    def __init__(self, response_id: _Optional[str] = ..., content: _Optional[str] = ..., widgets: _Optional[_Iterable[_Union[Widget, _Mapping]]] = ..., suggested_actions: _Optional[_Iterable[_Union[Action, _Mapping]]] = ..., metadata: _Optional[_Union[ResponseMetadata, _Mapping]] = ...) -> None: ...

class Widget(_message.Message):
    __slots__ = ("type", "widget_id", "config", "data")
    TYPE_FIELD_NUMBER: _ClassVar[int]
    WIDGET_ID_FIELD_NUMBER: _ClassVar[int]
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    type: str
    widget_id: str
    config: _struct_pb2.Struct
    data: _struct_pb2.Struct
    def __init__(self, type: _Optional[str] = ..., widget_id: _Optional[str] = ..., config: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., data: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class Action(_message.Message):
    __slots__ = ("action_id", "label", "description", "type", "params")
    class ParamsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    ACTION_ID_FIELD_NUMBER: _ClassVar[int]
    LABEL_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    PARAMS_FIELD_NUMBER: _ClassVar[int]
    action_id: str
    label: str
    description: str
    type: ActionType
    params: _containers.ScalarMap[str, str]
    def __init__(self, action_id: _Optional[str] = ..., label: _Optional[str] = ..., description: _Optional[str] = ..., type: _Optional[_Union[ActionType, str]] = ..., params: _Optional[_Mapping[str, str]] = ...) -> None: ...

class ResponseMetadata(_message.Message):
    __slots__ = ("timestamp", "tokens_used", "processing_time", "model_used", "extra")
    class ExtraEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    TOKENS_USED_FIELD_NUMBER: _ClassVar[int]
    PROCESSING_TIME_FIELD_NUMBER: _ClassVar[int]
    MODEL_USED_FIELD_NUMBER: _ClassVar[int]
    EXTRA_FIELD_NUMBER: _ClassVar[int]
    timestamp: _timestamp_pb2.Timestamp
    tokens_used: int
    processing_time: float
    model_used: str
    extra: _containers.ScalarMap[str, str]
    def __init__(self, timestamp: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., tokens_used: _Optional[int] = ..., processing_time: _Optional[float] = ..., model_used: _Optional[str] = ..., extra: _Optional[_Mapping[str, str]] = ...) -> None: ...

class StreamRequest(_message.Message):
    __slots__ = ("session_id", "include_widgets")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    INCLUDE_WIDGETS_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    include_widgets: bool
    def __init__(self, session_id: _Optional[str] = ..., include_widgets: bool = ...) -> None: ...

class StreamResponse(_message.Message):
    __slots__ = ("chunk_id", "content", "is_final", "widgets")
    CHUNK_ID_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    IS_FINAL_FIELD_NUMBER: _ClassVar[int]
    WIDGETS_FIELD_NUMBER: _ClassVar[int]
    chunk_id: str
    content: str
    is_final: bool
    widgets: _containers.RepeatedCompositeFieldContainer[Widget]
    def __init__(self, chunk_id: _Optional[str] = ..., content: _Optional[str] = ..., is_final: bool = ..., widgets: _Optional[_Iterable[_Union[Widget, _Mapping]]] = ...) -> None: ...

class GetHistoryRequest(_message.Message):
    __slots__ = ("session_id", "limit", "offset")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    limit: int
    offset: int
    def __init__(self, session_id: _Optional[str] = ..., limit: _Optional[int] = ..., offset: _Optional[int] = ...) -> None: ...

class GetHistoryResponse(_message.Message):
    __slots__ = ("messages", "total_count")
    MESSAGES_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    messages: _containers.RepeatedCompositeFieldContainer[ChatMessage]
    total_count: int
    def __init__(self, messages: _Optional[_Iterable[_Union[ChatMessage, _Mapping]]] = ..., total_count: _Optional[int] = ...) -> None: ...

class ChatMessage(_message.Message):
    __slots__ = ("message_id", "session_id", "sender", "content", "timestamp", "widgets", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    SENDER_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    WIDGETS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    message_id: str
    session_id: str
    sender: str
    content: str
    timestamp: _timestamp_pb2.Timestamp
    widgets: _containers.RepeatedCompositeFieldContainer[Widget]
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, message_id: _Optional[str] = ..., session_id: _Optional[str] = ..., sender: _Optional[str] = ..., content: _Optional[str] = ..., timestamp: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., widgets: _Optional[_Iterable[_Union[Widget, _Mapping]]] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class CreateSessionRequest(_message.Message):
    __slots__ = ("user_id", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, user_id: _Optional[str] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class CreateSessionResponse(_message.Message):
    __slots__ = ("session_id", "created_at")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    created_at: _timestamp_pb2.Timestamp
    def __init__(self, session_id: _Optional[str] = ..., created_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class EndSessionRequest(_message.Message):
    __slots__ = ("session_id",)
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    def __init__(self, session_id: _Optional[str] = ...) -> None: ...

class EndSessionResponse(_message.Message):
    __slots__ = ("success", "ended_at")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ENDED_AT_FIELD_NUMBER: _ClassVar[int]
    success: bool
    ended_at: _timestamp_pb2.Timestamp
    def __init__(self, success: bool = ..., ended_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...
