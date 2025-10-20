using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using LAB2.Models;
using LAB2.Hubs;
using ModelTask = LAB2.Models.Task;

namespace LAB2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TasksController : ControllerBase
    {
        private readonly LabAPIContext _context;
        private readonly IHubContext<TasksHub> _hub;

        public TasksController(LabAPIContext context, IHubContext<TasksHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ModelTask>>> GetTasks()
            => await _context.Tasks.ToListAsync();

        [HttpGet("{id:int}")]
        public async Task<ActionResult<ModelTask>> GetTask(int id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound();
            return task;
        }

        [HttpPost]
        public async Task<ActionResult<ModelTask>> PostTask(ModelTask task)
        {
            if (string.IsNullOrWhiteSpace(task.Name))
                return BadRequest("Name is required.");
            if (task.Priority < 1 || task.Priority > 10)
                return BadRequest("Priority must be between 1 and 10.");
            if (task.DueDate <= task.CreatedAt)
                return BadRequest("DueDate must be after CreatedAt.");

            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

         
            await _hub.Clients.All.SendAsync("TaskCreated", task);

            return CreatedAtAction(nameof(GetTask), new { id = task.Id }, task);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> PutTask(int id, ModelTask task)
        {
            if (id != task.Id) return BadRequest("ID mismatch.");
            if (string.IsNullOrWhiteSpace(task.Name))
                return BadRequest("Name is required.");
            if (task.Priority < 1 || task.Priority > 10)
                return BadRequest("Priority must be between 1 and 10.");
            if (task.DueDate <= task.CreatedAt)
                return BadRequest("DueDate must be after CreatedAt.");

            _context.Entry(task).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
              
                await _hub.Clients.All.SendAsync("TaskUpdated", task);
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Tasks.Any(e => e.Id == id)) return NotFound();
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound();
            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();

     
            await _hub.Clients.All.SendAsync("TaskDeleted", id);

            return NoContent();
        }

        private bool TaskExists(int id)
        {
            return _context.Tasks.Any(e => e.Id == id);
        }
    }
}
