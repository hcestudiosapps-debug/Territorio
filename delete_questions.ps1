$headers = @{
  "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaWxnZXJyYW96aWRmYnpoYXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzQyNTUsImV4cCI6MjA5NzE1MDI1NX0.isB3Zzw01lfgSgpNCBxSdYRR0GkPtuHhpjpqG4gq-1g"
}
Write-Host "Borrando todas las preguntas dinamicas..."
$del = Invoke-RestMethod -Method Delete -Uri "https://mnilgerraozidfbzhazr.supabase.co/rest/v1/preguntas?id=not.is.null" -Headers $headers
Write-Host "Preguntas borradas exitosamente."
