using KUT.Api.Models;

namespace KUT.Api.Data;

public static class DatabaseSeeder
{
    public static void Seed(KutDbContext db)
    {
        if (db.Organizations.Any())
        {
            // Backfill Capabilities for pre-existing vehicles from older seed runs.
            var caps = new Dictionary<string, string>
            {
                ["İtfaiye-34-K1"] = "yangin",
                ["İtfaiye-34-K2"] = "yangin",
                ["İtfaiye-34-B1"] = "yangin",
                ["İtfaiye-34-B2"] = "yangin,kurtarma",
                ["AKUT-1"] = "arama-kurtarma,kurtarma",
                ["AKUT-2"] = "arama-kurtarma,kurtarma",
            };
            var dirty = false;
            foreach (var v in db.Vehicles)
            {
                if (!string.IsNullOrWhiteSpace(v.Capabilities)) continue;
                if (caps.TryGetValue(v.Name, out var c))
                {
                    v.Capabilities = c;
                    dirty = true;
                }
            }
            if (dirty) db.SaveChanges();
            return;
        }

        var itfaiye = new Organization { Name = "İstanbul İtfaiyesi" };
        var akut = new Organization { Name = "AKUT" };
        db.Organizations.AddRange(itfaiye, akut);
        db.SaveChanges();

        var kadikoy = new Team { Name = "Kadıköy Ekibi", OrganizationId = itfaiye.Id };
        var besiktas = new Team { Name = "Beşiktaş Ekibi", OrganizationId = itfaiye.Id };
        var akutIst = new Team { Name = "AKUT İstanbul", OrganizationId = akut.Id };
        db.Teams.AddRange(kadikoy, besiktas, akutIst);
        db.SaveChanges();

        db.Vehicles.AddRange(
            new Vehicle { Name = "İtfaiye-34-K1", Type = "Yangın", Status = "Available", Capabilities = "yangin", TeamId = kadikoy.Id, Latitude = 40.9908, Longitude = 29.0300 },
            new Vehicle { Name = "İtfaiye-34-K2", Type = "Yangın", Status = "Available", Capabilities = "yangin", TeamId = kadikoy.Id, Latitude = 40.9750, Longitude = 29.0550 },
            new Vehicle { Name = "İtfaiye-34-B1", Type = "Yangın", Status = "Available", Capabilities = "yangin", TeamId = besiktas.Id, Latitude = 41.0428, Longitude = 29.0093 },
            new Vehicle { Name = "İtfaiye-34-B2", Type = "Merdivenli", Status = "Available", Capabilities = "yangin,kurtarma", TeamId = besiktas.Id, Latitude = 41.0350, Longitude = 28.9870 },
            new Vehicle { Name = "AKUT-1", Type = "Arama-Kurtarma", Status = "Available", Capabilities = "arama-kurtarma,kurtarma", TeamId = akutIst.Id, Latitude = 41.0200, Longitude = 28.9600 },
            new Vehicle { Name = "AKUT-2", Type = "Arama-Kurtarma", Status = "Available", Capabilities = "arama-kurtarma,kurtarma", TeamId = akutIst.Id, Latitude = 41.0100, Longitude = 29.0100 }
        );

        db.Incidents.AddRange(
            new Incident { Type = "Yangın", Severity = 5, Status = "Open", Latitude = 41.0180, Longitude = 28.9500, CreatedAt = DateTime.UtcNow.AddMinutes(-30) },
            new Incident { Type = "Trafik Kazası", Severity = 3, Status = "Open", Latitude = 40.9820, Longitude = 29.0400, CreatedAt = DateTime.UtcNow.AddMinutes(-18) },
            new Incident { Type = "Su Baskını", Severity = 2, Status = "Open", Latitude = 41.0500, Longitude = 29.0250, CreatedAt = DateTime.UtcNow.AddMinutes(-10) },
            new Incident { Type = "Bina Çökmesi", Severity = 4, Status = "Open", Latitude = 41.0060, Longitude = 28.9760, CreatedAt = DateTime.UtcNow.AddMinutes(-4) }
        );

        db.SaveChanges();
    }
}
