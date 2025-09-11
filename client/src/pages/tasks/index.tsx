import { Helmet } from "react-helmet";
import { TaskManager } from "@/components/tasks/TaskManager";

export default function TasksPage() {
  return (
    <>
      <Helmet>
        <title>Task e Alert | RealEstate CRM</title>
        <meta name="description" content="Gestisci task, promemoria e alert per le tue attività immobiliari con raggruppamento intelligente per cliente." />
      </Helmet>
      
      <TaskManager showTitle={true} />
    </>
  );
}
