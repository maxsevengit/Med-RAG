# Demo Queries for Testing Med-RAG System

## 🧪 Test Cases

### 1. **Approved Claims**

#### Age + Location + Policy Duration (Should Approve)
```
I'm 30 years old, need knee surgery, live in Mumbai, and my policy is 1 year old. What's my coverage?
```
**Expected Result**: Approved, $5,000 (Tier-1 city, age 30, policy >6 months)

#### Standard Coverage (Should Approve)
```
I'm 25 years old and need hip surgery. I live in Delhi. What's covered?
```
**Expected Result**: Approved, $5,000 (Tier-1 city, age 25, policy >6 months)

### 2. **Rejected Claims**

#### Age Below Minimum (Should Reject)
```
I'm 17 years old and need medical treatment. Is this covered?
```
**Expected Result**: Rejected, null amount (age 17 < minimum 18)

#### Age Above Maximum (Should Reject)
```
I'm 65 years old. Are my medical procedures covered?
```
**Expected Result**: Rejected, null amount (age 65 > maximum 60)

#### Policy Too New (Should Reject)
```
I need hip surgery but my policy is only 3 months old. What's covered?
```
**Expected Result**: Rejected, null amount (3 months < 6 month waiting period)

#### Below Minimum Age Requirement (Should Reject)
```
My 3-month-old child needs medical treatment. Is this covered?
```
**Expected Result**: Rejected, null amount (3 months < 6 month minimum age)

### 3. **Edge Cases**

#### Non-Tier-1 City (Should Approve with Lower Amount)
```
I'm 35 years old, need surgery, live in a small town, and my policy is 8 months old. What's covered?
```
**Expected Result**: Approved, $3,000 (non-Tier-1 city, age 35, policy >6 months)

#### Exactly at Age Boundary (Should Approve)
```
I'm exactly 18 years old and need medical treatment. Am I covered?
```
**Expected Result**: Approved, $3,000 or $5,000 (depending on city, age 18 = minimum)

#### Exactly at Policy Duration (Should Approve)
```
I'm 40 years old, need knee surgery, and my policy is exactly 6 months old. What's covered?
```
**Expected Result**: Approved, $3,000 or $5,000 (depending on city, 6 months = minimum)

## 🔍 Testing Instructions

1. **Start the system** using the startup script
2. **Wait for initialization** (check server console for "RAG pipeline initialized successfully")
3. **Copy and paste** each query from above
4. **Verify the response** matches expected results
5. **Check the justification** for logical reasoning

## 📊 Expected Response Format

```json
{
  "Decision": "approved" | "rejected",
  "Amount": number | null,
  "Justification": "detailed explanation based on policy clauses"
}
```

## 🚨 Common Issues to Watch For

- **API Key Errors**: Ensure Gemini API key is set in `.env`
- **Server Connection**: Backend must be running on port 3001
- **RAG Initialization**: Wait for pipeline to fully initialize
- **Response Parsing**: Check if Gemini returns valid JSON

## 🎯 Performance Expectations

- **First Query**: 5-10 seconds (cold start)
- **Subsequent Queries**: 3-5 seconds
- **Vector Search**: <1 second
- **Gemini API**: 2-4 seconds

## 🔧 Debug Mode

Enable detailed logging by checking:
- Server console for RAG pipeline status
- Browser console for frontend errors
- Network tab for API call details
