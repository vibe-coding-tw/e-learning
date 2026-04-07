import google.cloud.firestore
import json

db = google.cloud.firestore.Client(project='e-learning-942f7')
email = 'rover.k.chen@gmail.com'
unit_id = '01-unit-developer-identity.html'

def run():
    print(f"Searching assignments for {email} in unit {unit_id}")
    
    # 1. Exact match on userEmail
    docs = db.collection('assignments').where('userEmail', '==', email).get()
    
    found_any = False
    for doc in docs:
        data = doc.to_dict()
        if data.get('unitId') == unit_id or unit_id in doc.id:
            found_any = True
            print(f"\nMATCH FOUND: ID={doc.id}")
            # Format certain fields for readability
            output = {
                'id': doc.id,
                'unitId': data.get('unitId'),
                'assignmentId': data.get('assignmentId'),
                'assignedTutorEmail': data.get('assignedTutorEmail') or data.get('assignedTeacherEmail'),
                'status': data.get('status'),
                'submittedAt': str(data.get('submittedAt')),
                'grade': data.get('grade'),
                'submissionUrl': data.get('submissionUrl') or data.get('assignmentUrl')
            }
            print(json.dumps(output, indent=2))
        else:
            print(f"SKIPPING: ID={doc.id} (Unit: {data.get('unitId')})")
            
    if not found_any:
        print("\nNo direct match found for this email/unit combination.")
        # Search all records for this unit to see if UID is different
        print(f"Searching all assignments for unit {unit_id}...")
        unit_docs = db.collection('assignments').where('unitId', '==', unit_id).get()
        for doc in unit_docs:
            data = doc.to_dict()
            print(f" - Found record: ID={doc.id}, Email={data.get('userEmail')}, Tutor={data.get('assignedTutorEmail')}")

if __name__ == '__main__':
    run()
