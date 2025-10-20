
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace LAB2.Hubs
{
    public class TasksHub : Hub
    {
        
        public Task BroadcastTasksReordered(string[] orderedIds)
            => Clients.Others.SendAsync("TasksReordered", orderedIds);


        public Task BroadcastTaskCreated(object task) => Clients.Others.SendAsync("TaskCreated", task);
        public Task BroadcastTaskUpdated(object task) => Clients.Others.SendAsync("TaskUpdated", task);
        public Task BroadcastTaskDeleted(int id) => Clients.Others.SendAsync("TaskDeleted", id);
    }
}
