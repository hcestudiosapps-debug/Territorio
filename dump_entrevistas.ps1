$headers = @{
  "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaWxnZXJyYW96aWRmYnpoYXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzQyNTUsImV4cCI6MjA5NzE1MDI1NX0.isB3Zzw01lfgSgpNCBxSdYRR0GkPtuHhpjpqG4gq-1g"
}
$res = Invoke-RestMethod -Method Get -Uri "https://mnilgerraozidfbzhazr.supabase.co/rest/v1/entrevistas?select=*&limit=1" -Headers $headers
$res | ConvertTo-Json -Depth 5
