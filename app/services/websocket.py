"""
WebSocket manager for real-time communication with clients.
Handles real-time updates for ML processing, dataset uploads, and user notifications.
"""

import asyncio
import json
import logging
from typing import Dict, Set, List, Optional, Any
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict

logger = logging.getLogger(__name__)


class WebSocketMessage(BaseModel):
    """WebSocket message structure."""
    
    type: str
    data: Dict[str, Any]
    timestamp: datetime = datetime.utcnow()
    user_id: Optional[str] = None
    dataset_id: Optional[str] = None


class ConnectionInfo(BaseModel):
    """Connection information."""
    
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    websocket: WebSocket
    user_id: Optional[str] = None
    connected_at: datetime = datetime.utcnow()
    last_ping: datetime = datetime.utcnow()


class WebSocketManager:
    """
    WebSocket manager for handling real-time communications.
    
    Features:
    - Connection management and user tracking
    - Room-based message broadcasting
    - Processing progress updates
    - Dataset upload notifications
    - Error handling and reconnection support
    - Heartbeat/ping mechanism
    """
    
    def __init__(self):
        """Initialize WebSocket manager."""
        # Active connections by connection ID
        self.connections: Dict[str, ConnectionInfo] = {}
        
        # User to connections mapping
        self.user_connections: Dict[str, Set[str]] = {}
        
        # Dataset to interested users mapping
        self.dataset_watchers: Dict[str, Set[str]] = {}
        
        # Processing rooms
        self.processing_rooms: Dict[str, Set[str]] = {}
        
        # Connection counter for unique IDs
        self._connection_counter = 0
        
        # Start background tasks
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._start_background_tasks()
    
    def _start_background_tasks(self):
        """Start background maintenance tasks."""
        if not self._heartbeat_task or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
    
    async def connect(
        self,
        websocket: WebSocket,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Accept new WebSocket connection.
        
        Args:
            websocket: WebSocket connection
            user_id: Optional user ID for authenticated connections
            
        Returns:
            Connection ID
        """
        await websocket.accept()
        
        # Generate unique connection ID
        connection_id = f"conn_{self._connection_counter}"
        self._connection_counter += 1
        
        # Store connection info
        connection_info = ConnectionInfo(
            websocket=websocket,
            user_id=user_id,
        )
        self.connections[connection_id] = connection_info
        
        # Map user to connection if authenticated
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)
        
        logger.info(f"WebSocket connected: {connection_id} (user: {user_id})")
        
        # Send welcome message
        await self.send_to_connection(connection_id, {
            "type": "connection_established",
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        return connection_id
    
    async def disconnect(self, connection_id: str):
        """
        Handle WebSocket disconnection.
        
        Args:
            connection_id: Connection ID to disconnect
        """
        if connection_id not in self.connections:
            return
        
        connection_info = self.connections[connection_id]
        user_id = connection_info.user_id
        
        # Remove from user connections
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        # Remove from dataset watchers
        for dataset_id in list(self.dataset_watchers.keys()):
            self.dataset_watchers[dataset_id].discard(connection_id)
            if not self.dataset_watchers[dataset_id]:
                del self.dataset_watchers[dataset_id]
        
        # Remove from processing rooms
        for room_id in list(self.processing_rooms.keys()):
            self.processing_rooms[room_id].discard(connection_id)
            if not self.processing_rooms[room_id]:
                del self.processing_rooms[room_id]
        
        # Remove connection
        del self.connections[connection_id]
        
        logger.info(f"WebSocket disconnected: {connection_id} (user: {user_id})")
    
    async def send_to_connection(
        self,
        connection_id: str,
        message: Dict[str, Any],
    ) -> bool:
        """
        Send message to specific connection.
        
        Args:
            connection_id: Target connection ID
            message: Message to send
            
        Returns:
            True if message sent successfully
        """
        if connection_id not in self.connections:
            return False
        
        connection_info = self.connections[connection_id]
        
        try:
            await connection_info.websocket.send_text(json.dumps(message, default=str))
            return True
        except Exception as e:
            logger.warning(f"Failed to send message to {connection_id}: {e}")
            # Remove failed connection
            await self.disconnect(connection_id)
            return False
    
    async def send_to_user(
        self,
        user_id: str,
        message: Dict[str, Any],
    ) -> int:
        """
        Send message to all connections of a user.
        
        Args:
            user_id: Target user ID
            message: Message to send
            
        Returns:
            Number of connections message was sent to
        """
        if user_id not in self.user_connections:
            return 0
        
        sent_count = 0
        connection_ids = list(self.user_connections[user_id])
        
        for connection_id in connection_ids:
            if await self.send_to_connection(connection_id, message):
                sent_count += 1
        
        return sent_count
    
    async def broadcast_to_dataset_watchers(
        self,
        dataset_id: str,
        message: Dict[str, Any],
    ) -> int:
        """
        Broadcast message to all watchers of a dataset.
        
        Args:
            dataset_id: Dataset ID
            message: Message to broadcast
            
        Returns:
            Number of connections message was sent to
        """
        if dataset_id not in self.dataset_watchers:
            return 0
        
        sent_count = 0
        connection_ids = list(self.dataset_watchers[dataset_id])
        
        for connection_id in connection_ids:
            if await self.send_to_connection(connection_id, message):
                sent_count += 1
        
        return sent_count
    
    async def broadcast_to_all(self, message: Dict[str, Any]) -> int:
        """
        Broadcast message to all active connections.
        
        Args:
            message: Message to broadcast
            
        Returns:
            Number of connections message was sent to
        """
        sent_count = 0
        connection_ids = list(self.connections.keys())
        
        for connection_id in connection_ids:
            if await self.send_to_connection(connection_id, message):
                sent_count += 1
        
        return sent_count
    
    async def join_dataset_room(
        self,
        connection_id: str,
        dataset_id: str,
    ):
        """
        Add connection to dataset watchers.
        
        Args:
            connection_id: Connection ID
            dataset_id: Dataset ID to watch
        """
        if connection_id not in self.connections:
            return
        
        if dataset_id not in self.dataset_watchers:
            self.dataset_watchers[dataset_id] = set()
        
        self.dataset_watchers[dataset_id].add(connection_id)
        
        logger.debug(f"Connection {connection_id} joined dataset room {dataset_id}")
    
    async def leave_dataset_room(
        self,
        connection_id: str,
        dataset_id: str,
    ):
        """
        Remove connection from dataset watchers.
        
        Args:
            connection_id: Connection ID
            dataset_id: Dataset ID to stop watching
        """
        if dataset_id in self.dataset_watchers:
            self.dataset_watchers[dataset_id].discard(connection_id)
            if not self.dataset_watchers[dataset_id]:
                del self.dataset_watchers[dataset_id]
        
        logger.debug(f"Connection {connection_id} left dataset room {dataset_id}")
    
    async def notify_processing_started(
        self,
        dataset_id: str,
        config: Dict[str, Any],
        user_id: Optional[str] = None,
    ):
        """
        Notify about processing start.
        
        Args:
            dataset_id: Dataset ID being processed
            config: Processing configuration
            user_id: Optional user ID who started processing
        """
        message = {
            "type": "processing_started",
            "dataset_id": dataset_id,
            "config": config,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
        
        # Notify dataset watchers
        await self.broadcast_to_dataset_watchers(dataset_id, message)
        
        # Notify user if specified
        if user_id:
            await self.send_to_user(user_id, message)
    
    async def notify_processing_progress(
        self,
        dataset_id: str,
        stage: str,
        progress: float,
        message_text: str,
        user_id: Optional[str] = None,
    ):
        """
        Notify about processing progress.
        
        Args:
            dataset_id: Dataset ID being processed
            stage: Current processing stage
            progress: Progress percentage (0-100)
            message_text: Progress message
            user_id: Optional user ID
        """
        message = {
            "type": "processing_progress",
            "dataset_id": dataset_id,
            "stage": stage,
            "progress": progress,
            "message": message_text,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
        
        # Notify dataset watchers
        await self.broadcast_to_dataset_watchers(dataset_id, message)
        
        # Notify user if specified
        if user_id:
            await self.send_to_user(user_id, message)
    
    async def notify_processing_completed(
        self,
        dataset_id: str,
        result: Dict[str, Any],
        user_id: Optional[str] = None,
    ):
        """
        Notify about processing completion.
        
        Args:
            dataset_id: Dataset ID that was processed
            result: Processing results
            user_id: Optional user ID
        """
        message = {
            "type": "processing_completed",
            "dataset_id": dataset_id,
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
        
        # Notify dataset watchers
        await self.broadcast_to_dataset_watchers(dataset_id, message)
        
        # Notify user if specified
        if user_id:
            await self.send_to_user(user_id, message)
    
    async def notify_processing_error(
        self,
        dataset_id: str,
        error: str,
        user_id: Optional[str] = None,
    ):
        """
        Notify about processing error.
        
        Args:
            dataset_id: Dataset ID that failed processing
            error: Error message
            user_id: Optional user ID
        """
        message = {
            "type": "processing_error",
            "dataset_id": dataset_id,
            "error": error,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
        
        # Notify dataset watchers
        await self.broadcast_to_dataset_watchers(dataset_id, message)
        
        # Notify user if specified
        if user_id:
            await self.send_to_user(user_id, message)
    
    async def notify_rag_completed(
        self,
        dataset_id: str,
        explanations: List[Dict[str, Any]],
        user_id: Optional[str] = None,
    ):
        """
        Notify about RAG explanation completion.
        
        Args:
            dataset_id: Dataset ID
            explanations: Generated explanations
            user_id: Optional user ID
        """
        message = {
            "type": "rag_completed",
            "dataset_id": dataset_id,
            "explanations": explanations,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
        }
        
        # Notify dataset watchers
        await self.broadcast_to_dataset_watchers(dataset_id, message)
        
        # Notify user if specified
        if user_id:
            await self.send_to_user(user_id, message)
    
    async def handle_message(
        self,
        connection_id: str,
        message_data: Dict[str, Any],
    ):
        """
        Handle incoming WebSocket message.
        
        Args:
            connection_id: Connection ID that sent the message
            message_data: Message data
        """
        message_type = message_data.get("type")
        
        if message_type == "ping":
            # Handle ping/pong for connection health
            await self.send_to_connection(connection_id, {"type": "pong"})
            
            # Update last ping time
            if connection_id in self.connections:
                self.connections[connection_id].last_ping = datetime.utcnow()
        
        elif message_type == "join_dataset":
            # Join dataset room for updates
            dataset_id = message_data.get("dataset_id")
            if dataset_id:
                await self.join_dataset_room(connection_id, dataset_id)
        
        elif message_type == "leave_dataset":
            # Leave dataset room
            dataset_id = message_data.get("dataset_id")
            if dataset_id:
                await self.leave_dataset_room(connection_id, dataset_id)
        
        else:
            logger.warning(f"Unknown message type: {message_type}")
    
    async def _heartbeat_loop(self):
        """Background task to check connection health."""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                current_time = datetime.utcnow()
                stale_connections = []
                
                # Find stale connections (no ping in 2 minutes)
                for connection_id, conn_info in self.connections.items():
                    time_since_ping = (current_time - conn_info.last_ping).total_seconds()
                    if time_since_ping > 120:  # 2 minutes
                        stale_connections.append(connection_id)
                
                # Remove stale connections
                for connection_id in stale_connections:
                    logger.info(f"Removing stale connection: {connection_id}")
                    await self.disconnect(connection_id)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat loop error: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """
        Get WebSocket connection statistics.
        
        Returns:
            Dictionary with connection statistics
        """
        total_connections = len(self.connections)
        authenticated_connections = len([
            conn for conn in self.connections.values()
            if conn.user_id is not None
        ])
        
        return {
            "total_connections": total_connections,
            "authenticated_connections": authenticated_connections,
            "anonymous_connections": total_connections - authenticated_connections,
            "unique_users": len(self.user_connections),
            "dataset_watchers": len(self.dataset_watchers),
            "processing_rooms": len(self.processing_rooms),
        }
    
    async def close_all_connections(self):
        """Close all WebSocket connections."""
        connection_ids = list(self.connections.keys())
        
        for connection_id in connection_ids:
            try:
                conn_info = self.connections[connection_id]
                await conn_info.websocket.close()
            except Exception as e:
                logger.warning(f"Error closing connection {connection_id}: {e}")
            finally:
                await self.disconnect(connection_id)
        
        # Cancel background tasks
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        logger.info("All WebSocket connections closed")