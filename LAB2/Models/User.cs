using System.ComponentModel.DataAnnotations;

namespace LAB2.Models
{
    public class User
    {
       public User()
        {
            Tasks = new List<Task>();
        }
        public int Id { get; set; }

        [Required(ErrorMessage = "Поле не може бути порожнім")]
        [Display(Name = "Назва")]
        public string Name { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
        public virtual ICollection<Task> Tasks { get; set; } = new List<Task>();
    }
}
