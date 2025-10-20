
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
namespace LAB2.Models
{
    public class LabAPIContext : DbContext
    {

     
        public DbSet<Task> Tasks { get; set; }
        public LabAPIContext(DbContextOptions<LabAPIContext> options) : base(options)
        {
            Database.EnsureCreated();
        }
    }


}
