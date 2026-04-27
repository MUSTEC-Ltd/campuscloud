#!/usr/bin/env bash
# End-to-end test for project permission/role model.
# Requires backend running on :5000.
set -u
BASE=http://localhost:5000

step() { echo; echo "===== $* ====="; }

# Use unique emails so reruns don't collide.
TS=$(date +%s)
A_EMAIL="alice_${TS}@gmail.com"
B_EMAIL="bob_${TS}@gmail.com"
PASS='Abcdef1!'

extract() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);console.log(o.$1||'')}catch(e){}});"; }

step "1. Register A ($A_EMAIL)"
A_TOK=$(curl -s -H 'Content-Type: application/json' -d "{\"email\":\"$A_EMAIL\",\"password\":\"$PASS\"}" $BASE/register | extract accessToken)
echo "A token=${A_TOK:0:30}..."

step "2. Register B ($B_EMAIL)"
B_TOK=$(curl -s -H 'Content-Type: application/json' -d "{\"email\":\"$B_EMAIL\",\"password\":\"$PASS\"}" $BASE/register | extract accessToken)
echo "B token=${B_TOK:0:30}..."

step "3. A creates project proj_${TS}"
CREATE=$(curl -s -H 'Content-Type: application/json' -H "Authorization: Bearer $A_TOK" -d "{\"name\":\"proj_${TS}\",\"description\":\"shared demo\"}" $BASE/project)
echo "$CREATE"
PID=$(echo "$CREATE" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).project.id)});")
echo "project id=$PID"

step "4. B GET /project/$PID (expect 404 — deny by default)"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -H "Authorization: Bearer $B_TOK" $BASE/project/$PID
curl -s -H "Authorization: Bearer $B_TOK" $BASE/project/$PID; echo

step "5. A invites B as viewer"
curl -s -H 'Content-Type: application/json' -H "Authorization: Bearer $A_TOK" -d "{\"email\":\"$B_EMAIL\",\"role\":\"viewer\"}" $BASE/project/$PID/members; echo

step "6. B GET /project/$PID (expect 200, role=viewer)"
curl -s -H "Authorization: Bearer $B_TOK" $BASE/project/$PID; echo

step "7. B PUT /project/$PID (expect 403)"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X PUT -H 'Content-Type: application/json' -H "Authorization: Bearer $B_TOK" -d '{"description":"hax"}' $BASE/project/$PID
curl -s -X PUT -H 'Content-Type: application/json' -H "Authorization: Bearer $B_TOK" -d '{"description":"hax"}' $BASE/project/$PID; echo

step "8. A promotes B to editor; B PUT (expect 200)"
curl -s -H 'Content-Type: application/json' -H "Authorization: Bearer $A_TOK" -d "{\"email\":\"$B_EMAIL\",\"role\":\"editor\"}" $BASE/project/$PID/members; echo
curl -s -X PUT -H 'Content-Type: application/json' -H "Authorization: Bearer $B_TOK" -d '{"description":"edited by B"}' $BASE/project/$PID; echo

step "9. B DELETE /project/$PID (expect 403)"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X DELETE -H "Authorization: Bearer $B_TOK" $BASE/project/$PID
curl -s -X DELETE -H "Authorization: Bearer $B_TOK" $BASE/project/$PID; echo

step "10. A lists members"
MEMBERS=$(curl -s -H "Authorization: Bearer $A_TOK" $BASE/project/$PID/members)
echo "$MEMBERS"
B_UID=$(echo "$MEMBERS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);const b=a.find(m=>m.email.startsWith('bob_'));console.log(b?b.user_id:'')})")
echo "B user_id=$B_UID"

step "11. A removes B; B GET (expect 404)"
curl -s -X DELETE -H "Authorization: Bearer $A_TOK" $BASE/project/$PID/members/$B_UID; echo
curl -s -o /dev/null -w "HTTP %{http_code}\n" -H "Authorization: Bearer $B_TOK" $BASE/project/$PID

step "12. A removes self while sole owner (expect 409)"
A_UID=$(curl -s -H "Authorization: Bearer $A_TOK" $BASE/project/$PID/members | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s)[0].user_id)})")
echo "A user_id=$A_UID"
curl -s -X DELETE -H "Authorization: Bearer $A_TOK" $BASE/project/$PID/members/$A_UID; echo

step "13. A soft-deletes project (expect 200)"
curl -s -X DELETE -H "Authorization: Bearer $A_TOK" $BASE/project/$PID; echo

step "14. A GET deleted project (expect 404)"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -H "Authorization: Bearer $A_TOK" $BASE/project/$PID

echo; echo "===== DONE ====="
