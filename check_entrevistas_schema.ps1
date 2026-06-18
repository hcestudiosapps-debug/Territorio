$headers = @{
  "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaWxnZXJyYW96aWRmYnpoYXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzQyNTUsImV4cCI6MjA5NzE1MDI1NX0.isB3Zzw01lfgSgpNCBxSdYRR0GkPtuHhpjpqG4gq-1g"
}
Write-Host "Revisando estructura de la tabla entrevistas..."
$result = Invoke-RestMethod -Method Get -Uri "https://mnilgerraozidfbzhazr.supabase.co/rest/v1/entrevistas?select=*&limit=1" -Headers $headers
if ($result.Count -gt 0) {
    $result[0] | Get-Member -MemberType NoteProperty | Select-Object Name | ForEach-Object { Write-Host "  Campo: $($_.Name)" }
} else {
    Write-Host "La tabla está vacía, no se puede inferir la estructura fácilmente así."
}
