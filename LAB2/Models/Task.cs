using LAB2.Models;
using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;
namespace LAB2.Models
{
    public class Task
    {
        public int Id { get; set; }
        public int UserId { get; set; } // Foreign key to User
        [Required(ErrorMessage = "Поле не може бути порожнім")]
        [Display(Name = "Назва")]
        public string Name { get; set; }
        public string Description { get; set; }
        public int Priority { get; set; }
        public string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime DueDate { get; set; }

        [JsonIgnore]
        public virtual User? User { get; set; } // Navigation property to User
        public Task()
        {
            CreatedAt = DateTime.Now;
            Status = "Not done";
            Priority = 5;
        }

    }
}
