using KUT.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Data;

public class KutDbContext : DbContext
{
    public KutDbContext(DbContextOptions<KutDbContext> options)
        : base(options)
    {
    }

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
}