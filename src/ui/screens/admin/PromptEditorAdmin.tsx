import React from "react";
import AdminLayout from "./AdminLayout";
import PromptEditor from "./prompt-editor/PromptEditor";

const PromptEditorAdmin: React.FC = () => {
    return (
        <AdminLayout
            title="Prompt Editor"
            subtitle="Manage the base system, global audio, and fact extractor prompts in one place."
        >
            <PromptEditor />
        </AdminLayout>
    );
};

export default PromptEditorAdmin;
