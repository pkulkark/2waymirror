/** Runtime and deployment diagrams adapted from the desktop mockup. */

export function RuntimeDiagram() {
  return (
    <svg
      width="888"
      height="270"
      viewBox="0 0 888 270"
      fill="none"
      role="img"
      focusable="false"
      aria-label="Architecture diagram"
      className="block h-auto w-full font-sans"
    >
      <desc>
        Browser requests go through CloudFront. Static files come from the web S3 bucket. API
        requests go through API Gateway to FastAPI on Lambda, which reads and writes sessions and
        answers in DynamoDB and reads candidate content from a separate private S3 bucket.
      </desc>

      {/* Nodes */}
      <rect
        x="6"
        y="16"
        width="126"
        height="54"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="69" y="48" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        Browser
      </text>

      <rect
        x="196"
        y="16"
        width="160"
        height="54"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="276" y="48" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        CloudFront
      </text>

      <rect
        x="478"
        y="16"
        width="200"
        height="54"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="578" y="40" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        S3 web bucket
      </text>
      <text
        x="578"
        y="58"
        textAnchor="middle"
        fontSize="12"
        fontWeight="400"
        fill="var(--muted-ink)"
      >
        React build
      </text>

      <rect
        x="196"
        y="150"
        width="160"
        height="54"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="276" y="182" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        API Gateway
      </text>

      <rect
        x="430"
        y="150"
        width="170"
        height="54"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="515" y="174" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        Lambda
      </text>
      <text
        x="515"
        y="192"
        textAnchor="middle"
        fontSize="12"
        fontWeight="400"
        fill="var(--muted-ink)"
      >
        FastAPI
      </text>

      <rect
        x="666"
        y="104"
        width="216"
        height="54"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="774" y="128" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        DynamoDB
      </text>
      <text
        x="774"
        y="146"
        textAnchor="middle"
        fontSize="12"
        fontWeight="400"
        fill="var(--muted-ink)"
      >
        sessions and answers
      </text>

      <rect
        x="666"
        y="196"
        width="216"
        height="54"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="774" y="220" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
        S3 content bucket
      </text>
      <text
        x="774"
        y="238"
        textAnchor="middle"
        fontSize="12"
        fontWeight="400"
        fill="var(--muted-ink)"
      >
        private, read only
      </text>

      {/* Browser to CloudFront */}
      <path
        d="M132 43 L189 43"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M196 43 L189 39 L189 47 Z" fill="var(--muted-ink)"></path>

      {/* CloudFront to S3 web bucket */}
      <path
        d="M356 43 L471 43"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M478 43 L471 39 L471 47 Z" fill="var(--muted-ink)"></path>
      <text x="417" y="33" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--moss)">
        static
      </text>

      {/* CloudFront down to API Gateway */}
      <path
        d="M276 70 L276 143"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M276 150 L272 143 L280 143 Z" fill="var(--muted-ink)"></path>
      <text x="288" y="112" textAnchor="start" fontSize="12" fontWeight="600" fill="var(--moss)">
        /api/*
      </text>

      {/* API Gateway to Lambda */}
      <path
        d="M356 177 L423 177"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M430 177 L423 173 L423 181 Z" fill="var(--muted-ink)"></path>

      {/* Lambda to DynamoDB */}
      <path
        d="M600 177 L633 177 L633 131 L659 131"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path d="M666 131 L659 127 L659 135 Z" fill="var(--muted-ink)"></path>

      {/* Lambda to S3 content bucket */}
      <path
        d="M600 177 L633 177 L633 223 L659 223"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path d="M666 223 L659 219 L659 227 Z" fill="var(--muted-ink)"></path>
    </svg>
  )
}

export function DeployDiagram() {
  return (
    <svg
      width="888"
      height="60"
      viewBox="0 0 888 60"
      fill="none"
      role="img"
      focusable="false"
      aria-label="Deploy pipeline"
      className="block h-auto w-full font-sans"
    >
      <desc>
        A push to main starts GitHub Actions with short-lived AWS credentials through OIDC. The
        workflow builds the Lambda package, applies Terraform, then builds and uploads the frontend
        to S3 and invalidates the CloudFront cache.
      </desc>

      <rect
        x="0"
        y="6"
        width="158"
        height="48"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="79" y="35" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        Push to main
      </text>

      <path
        d="M158 30 L176 30"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M182 30 L176 26.5 L176 33.5 Z" fill="var(--muted-ink)"></path>

      <rect
        x="182"
        y="6"
        width="158"
        height="48"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="261" y="26" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        GitHub Actions, OIDC,
      </text>
      <text x="261" y="42" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        no stored keys
      </text>

      <path
        d="M340 30 L358 30"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M364 30 L358 26.5 L358 33.5 Z" fill="var(--muted-ink)"></path>

      <rect
        x="364"
        y="6"
        width="158"
        height="48"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="443" y="35" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        Build Lambda package
      </text>

      <path
        d="M522 30 L540 30"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M546 30 L540 26.5 L540 33.5 Z" fill="var(--muted-ink)"></path>

      <rect
        x="546"
        y="6"
        width="158"
        height="48"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="625" y="35" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        Terraform apply
      </text>

      <path
        d="M704 30 L722 30"
        stroke="var(--muted-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      ></path>
      <path d="M728 30 L722 26.5 L722 33.5 Z" fill="var(--muted-ink)"></path>

      <rect
        x="728"
        y="6"
        width="158"
        height="48"
        rx="8"
        fill="var(--surface)"
        stroke="var(--surface-border)"
        strokeWidth="1"
      ></rect>
      <text x="807" y="26" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        S3 build and
      </text>
      <text x="807" y="42" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        CloudFront invalidation
      </text>
    </svg>
  )
}
