export const formatValidationErrors = (errors) => {
    if (!errors || !errors.issues) return "Validation Failed";
    if (Array.isArray(errors.issues)) {
        return errors.issues.map(issue => {
            if (issue.path && issue.path.length > 0) {
                return `${issue.path.join('.')} - ${issue.message}`;
            } else {
                return issue.message;
            }
        }).join(', ');
    }
    return JSON.stringify(errors);
}